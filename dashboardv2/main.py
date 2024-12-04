from nicegui import ui
import requests
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
import os
import plotly.graph_objects as go
from collections import defaultdict
from datetime import timedelta
import asyncio
import pytz
import logging
from enum import IntEnum

# Load environment variables
load_dotenv()
API_KEY = os.getenv('API_KEY', '')

LOCAL_API = "http://api:5001/legion-32c6d/us-central1"
PROD_API = "https://us-central1-legion-32c6d.cloudfunctions.net"

current_api = PROD_API
last_visit = None
game_logs_cache = {}  # Cache for storing game logs

PLAY_MODE = {
    0: "PRACTICE",
    1: "TUTORIAL",
    2: "CASUAL",
    3: "CASUAL_VS_AI",
    4: "RANKED",
    5: "RANKED_VS_AI",
    6: "STAKED"
}

TIMEZONE = pytz.timezone('Europe/Brussels')

# At the start of your script, configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class GameAction(IntEnum):
    SPELL_USE = 0
    ITEM_USE = 1
    MOVE = 2
    ATTACK = 3

GAME_ACTION_NAMES = {
    GameAction.SPELL_USE: "Used spell",
    GameAction.ITEM_USE: "Used item",
    GameAction.MOVE: "Moved",
    GameAction.ATTACK: "Attacked"
}

def get_headers():
    if current_api == PROD_API:
        return {'X-API-Key': API_KEY}
    return {}

def get_last_visit() -> Optional[str]:
    global last_visit
    return last_visit

def update_last_visit():
    global last_visit
    last_visit = datetime.utcnow().isoformat()

async def toggle_api():
    global current_api
    current_api = LOCAL_API if current_api == PROD_API else PROD_API
    api_label.text = f"Current API: {current_api}"
    if current_api == PROD_API and not API_KEY:
        ui.notify('Warning: No API key set for production API', type='warning')
    await load_players()

def format_date(date_str):
    if not date_str:
        return 'N/A'
    try:
        # Parse UTC time and convert to Belgian time
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        dt_utc = dt.replace(tzinfo=pytz.UTC)
        dt_local = dt_utc.astimezone(TIMEZONE)
        return dt_local.strftime('%d/%m/%y %H:%M:%S')
    except:
        return date_str

def shorten_id(player_id):
    return f"{player_id[:6]}...{player_id[-4:]}"

def is_new_player(join_date: str) -> bool:
    last_visit = get_last_visit()
    if not last_visit or not join_date:
        return False
    try:
        join_dt = datetime.fromisoformat(join_date.replace('Z', '+00:00'))
        last_visit_dt = datetime.fromisoformat(last_visit)
        return join_dt > last_visit_dt
    except:
        return False

async def fetch_game_history(player_id: str):
    try:
        response = await asyncio.to_thread(
            requests.get,
            f"{current_api}/getPlayerGameHistory",
            params={'playerId': player_id},
            headers=get_headers()
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        logger.error(f"Error fetching game history: {e}")
        return []

async def fetch_action_log(player_id=None):
    if not player_id:
        player_id = player_id_input.value
    if not player_id:
        ui.notify('Please enter or select a Player ID', type='warning')
        return

    # Update selected player and update highlighting
    global selected_player_id
    selected_player_id = player_id
    update_player_cards_highlighting()

    # Show spinner next to the button
    fetch_spinner.visible = True

    try:
        # Fetch both action log and game history in parallel
        action_log_future = asyncio.create_task(asyncio.to_thread(
            requests.get,
            f"{current_api}/getActionLog",
            params={'playerId': player_id},
            headers=get_headers()
        ))
        game_history_future = asyncio.create_task(fetch_game_history(player_id))
        
        # Wait for both requests to complete
        action_log_response = await action_log_future
        game_history = await game_history_future

        if action_log_response.status_code == 200:
            actions.clear()
            data = action_log_response.json()
            
            with actions:
                # Player Summary Card
                with ui.card().classes('w-full mb-4'):
                    with ui.row().classes('items-center gap-2'):
                        ui.label(f'Player {player_id} Summary').classes('text-lg font-bold')
                        ui.button(icon='content_copy', on_click=lambda p=player_id: copy_to_clipboard(p)) \
                            .props('flat dense padding="0 0"') \
                            .classes('text-gray-500 hover:text-gray-700')
                    summary = data.get('playerSummary', {})
                    ui.label(f"Join Date: {format_date(summary.get('joinDate', 'N/A'))}")
                    ui.label(f"Last Active: {format_date(summary.get('lastActiveDate', 'N/A'))}")
                
                # Games Log Section
                ui.label('Games Log').classes('text-lg font-bold mt-4')
                with ui.card().classes('w-full mb-4'):
                    if not game_history:
                        ui.label('No games found').classes('text-gray-500 italic')
                    else:
                        for game in game_history:
                            with ui.card().classes('w-full mb-2'):
                                with ui.row().classes('items-center justify-between p-2'):
                                    # Game info
                                    start_date = format_date(game.get('startDate'))
                                    game_id = game.get('gameId', 'Unknown ID')
                                    
                                    # Compute duration
                                    if game.get('endDate'):
                                        end_date = datetime.fromisoformat(game.get('endDate').replace('Z', '+00:00'))
                                        duration = end_date - datetime.fromisoformat(game.get('startDate').replace('Z', '+00:00'))
                                        duration_str = f"{duration.total_seconds() // 60} min"
                                    else:
                                        duration_str = "In progress"
                                    
                                    # Left side: game information
                                    with ui.row().classes('items-center gap-2 flex-grow'):
                                        ui.label(f"{start_date} - {game_id} - {duration_str} - {game.get('mode', 'Unknown')} - {game.get('league', 'Unknown')}") \
                                            .classes('text-gray-700')
                                        ui.label("Won" if game.get('playerWon') else "Lost").classes(
                                            'font-bold text-green-600' if game.get('playerWon') else 'font-bold text-red-600'
                                        )
                                    
                                    # Right side: replay button if available
                                    if game.get('hasReplay'):
                                        async def make_open_replay(specific_game_id):
                                            async def open_replay():
                                                await ui.run_javascript(f'window.open("https://www.play-legion.io/replay/{specific_game_id}", "_blank")')
                                            return open_replay
                                            
                                        ui.button(icon='play_circle_outline', on_click=await make_open_replay(game.get('gameId'))) \
                                            .props('flat dense padding="0 4px"') \
                                            .classes('text-blue-500 hover:text-blue-700')
                
                # Action Log Section (existing code)
                ui.label('Events Log').classes('text-lg font-bold mt-4')
                
                # First, create all the cards and store them in a list
                cards = []
                
                # Find the last tutorial action first
                last_tutorial = None
                last_tutorial_timestamp = None
                for action in data.get('actionLog', []):
                    if action.get('actionType') == 'tutorial' and isinstance(action.get('details'), str):
                        last_tutorial = action.get('details')
                        last_tutorial_timestamp = action.get('timestamp')
                
                # Create card for tutorial if exists
                if last_tutorial:
                    timestamp_value = 0
                    if isinstance(last_tutorial_timestamp, dict) and '_seconds' in last_tutorial_timestamp:
                        timestamp_value = float(last_tutorial_timestamp['_seconds'])
                    elif isinstance(last_tutorial_timestamp, str):
                        try:
                            timestamp_value = datetime.fromisoformat(last_tutorial_timestamp.replace('Z', '+00:00')).timestamp()
                        except:
                            pass
                    
                    cards.append({
                        'timestamp_value': timestamp_value,
                        'time_str': format_timestamp(last_tutorial_timestamp),
                        'content': f"Tutorial up to {last_tutorial}",
                        'type': 'tutorial',
                        'details': None
                    })
                
                # Create cards for other actions
                for action in data.get('actionLog', []):
                    if action.get('actionType') == 'tutorial':
                        continue
                        
                    timestamp = action.get('timestamp')
                    timestamp_value = 0
                    if isinstance(timestamp, dict) and '_seconds' in timestamp:
                        timestamp_value = float(timestamp['_seconds'])
                    elif isinstance(timestamp, str):
                        try:
                            timestamp_value = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp()
                        except:
                            pass
                    
                    action_type = action.get('actionType', 'N/A')
                    details = action.get('details', {})
                    
                    # Handle action types
                    if action_type == 'loadGame' and isinstance(details, dict) and details.get('message'):
                        content = f"loadGame - {details.get('message')}"
                    elif action_type == 'pageView' and isinstance(details, dict) and details.get('message'):
                        # logging.info(f"pageView - {details.get('message')}")
                        content = f"pageView - {details.get('message')}"
                    elif action_type == 'gameStart' and isinstance(details, dict) and details.get('mode') is not None:
                        mode = PLAY_MODE.get(details.get('mode'), 'UNKNOWN')
                        content = f"gameStart - {mode}"
                    elif action_type == 'gameComplete':
                        content = f"gameComplete - Game {details.get('gameId')}"
                    else:
                        content = action_type

                    cards.append({
                        'timestamp_value': timestamp_value,
                        'time_str': format_timestamp(timestamp),
                        'content': content,
                        'type': action_type,
                        'details': details if action_type not in ['loadGame', 'tutorial', 'pageView', 'gameStart', 'gameComplete'] else None,
                        'is_mobile': isinstance(details, dict) and details.get('mobile')
                    })
                
                # Sort cards by timestamp
                cards.sort(key=lambda x: x['timestamp_value'])
                
                # Render all cards in sorted order
                for card in cards:
                    with ui.card().classes('w-full mb-2 p-2'):
                        with ui.row().classes('items-center gap-2'):
                            ui.label(card['time_str']).classes('font-mono text-gray-600')
                            ui.label(card['content']).classes('font-bold')
                            if 'is_mobile' in card and card['is_mobile'] is not None:
                                ui.label('📱' if card['is_mobile'] else '💻').classes('text-xl')
                            
                            if card['details'] and card['type'] != 'game_log':
                                ui.label(f"Details: {card['details']}").classes('text-sm font-mono')
    except Exception as e:
        ui.notify(f'Error: {str(e)}', type='error')
    finally:
        # Hide spinner when done
        fetch_spinner.visible = False

def update_player_cards_highlighting():
    """Update the highlighting of player cards without reloading the data"""
    for card, player_id in player_cards.items():
        if player_id == selected_player_id:
            card.classes('bg-blue-100 hover:bg-blue-200', remove='hover:bg-gray-100')
        else:
            card.classes('hover:bg-gray-100', remove='bg-blue-100 hover:bg-blue-200')

async def load_players():
    global player_cards
    player_cards = {}
    players_list.clear()
    
    with players_list:
        spinner = ui.spinner(size='3em').classes('absolute top-1/2 left-1/2')
    try:
        response = await asyncio.to_thread(
            requests.get,
            f"{current_api}/listPlayerIDs",
            headers=get_headers()
        )
        if response.status_code == 200:
            players = sorted(
                response.json(),
                key=lambda x: x.get('joinDate', ''),
                reverse=True
            )

            spinner.delete()

            with players_list:
                for player in players:
                    player_id = player.get('id')
                    join_date = player.get('joinDate')
                    formatted_date = format_date(join_date)

                    async def on_player_click(p=player_id):
                        await fetch_action_log(p)

                    card_classes = 'w-full mb-2 p-2 cursor-pointer hover:bg-gray-100'
                    card = ui.card().classes(card_classes).on('click', on_player_click)
                    player_cards[card] = player_id

                    with card:
                        with ui.row().classes('items-center gap-2'):
                            ui.label(f"ID: {shorten_id(player_id)}").classes('font-mono')
                            if is_new_player(join_date):
                                ui.label('NEW').classes('px-2 py-0.5 text-xs bg-green-500 text-white rounded-full')
                        ui.label(f"Joined: {formatted_date}").classes('text-sm text-gray-600')
        elif response.status_code == 401:
            spinner.delete()
            ui.notify('Unauthorized: Check your API key', type='error')
            players_list.clear()
            with players_list:
                ui.label('Unable to load players: Unauthorized').classes('text-red-500')
        else:
            spinner.delete()
            ui.notify(f'Error loading players: {response.status_code}', type='error')
    except Exception as e:
        spinner.delete()
        ui.notify(f'Error loading players: {str(e)}', type='error')

async def fetch_dashboard_data():
    try:
        response = await asyncio.to_thread(
            requests.get,
            f"{current_api}/getDashboardData",
            headers=get_headers()
        )
        if response.status_code == 200:
            data = response.json()
            
            # Filter data based on cutoff date
            cutoff_date = datetime.strptime(date_input.value, '%Y-%m-%d').date()
            
            # Plot new players per day
            dates = list(data['newPlayersPerDay'].keys())
            player_counts = list(data['newPlayersPerDay'].values())
            
            # Filter data points after cutoff date
            filtered_data = [(date, count) for date, count in zip(dates, player_counts) 
                           if datetime.strptime(date, '%Y-%m-%d').date() >= cutoff_date]
            dates, player_counts = zip(*filtered_data) if filtered_data else ([], [])
            
            new_players_fig = go.Figure()
            new_players_fig.add_trace(go.Bar(
                x=dates,
                y=player_counts,
                name='New Players'
            ))
            new_players_fig.update_layout(
                title='New Players per Day',
                xaxis_title='Date',
                yaxis_title='Number of New Players',
                height=400,
                width=600,
                margin=dict(l=50, r=20, t=40, b=40),
                xaxis=dict(
                    dtick='D1',  # One tick per day
                    tickformat='%d/%m'  # Show as DD/MM
                )
            )
            
            # Calculate total games per day
            games_per_day = defaultdict(int)
            for date, modes in data['gamesPerModePerDay'].items():
                if datetime.strptime(date, '%Y-%m-%d').date() >= cutoff_date:
                    games_per_day[date] = sum(modes.values())
            
            dates = list(games_per_day.keys())
            game_counts = list(games_per_day.values())
            
            games_fig = go.Figure()
            games_fig.add_trace(go.Bar(
                x=dates,
                y=game_counts,
                name='Games Played'
            ))
            games_fig.update_layout(
                title='Games Played per Day',
                xaxis_title='Date',
                yaxis_title='Number of Games',
                height=400,
                width=600,
                margin=dict(l=50, r=20, t=40, b=40),
                xaxis=dict(
                    dtick='D1',  # One tick per day
                    tickformat='%d/%m'  # Show as DD/MM
                )
            )
            
            # Update the plots in the UI
            new_players_plot.clear()
            games_plot.clear()
            with new_players_plot:
                ui.plotly(new_players_fig).classes('w-full')
            with games_plot:
                ui.plotly(games_fig).classes('w-full')
            
        else:
            ui.notify(f'Error fetching dashboard data: {response.status_code}', type='error')
    except Exception as e:
        ui.notify(f'Error: {str(e)}', type='error')

def fetch_engagement_metrics():
    try:
        # Use the same date as the dashboard data
        date = date_input.value
        
        response = requests.get(
            f"{current_api}/getEngagementMetrics",
            params={'date': date},
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Update the metrics cards
            metrics_container.clear()
            with metrics_container:
                with ui.row().classes('w-full gap-4 justify-between'):
                    with ui.card().classes('flex-1 p-4'):
                        ui.label('Total New Players').classes('text-lg font-bold')
                        ui.label(str(data['totalPlayers'])).classes('text-2xl mt-2')
                    
                    with ui.card().classes('flex-1 p-4'):
                        ui.label('Tutorial Completion').classes('text-lg font-bold')
                        ui.label(f"{data['tutorialCompletionRate']:.1f}%").classes('text-2xl mt-2')
                    
                    with ui.card().classes('flex-1 p-4'):
                        ui.label('Played At Least 1 Game').classes('text-lg font-bold')
                        ui.label(f"{data['playedOneGameRate']:.1f}%").classes('text-2xl mt-2')
                    
                    with ui.card().classes('flex-1 p-4'):
                        ui.label('Played Multiple Games').classes('text-lg font-bold')
                        ui.label(f"{data['playedMultipleGamesRate']:.1f}%").classes('text-2xl mt-2')
                    
                    with ui.card().classes('flex-1 p-4'):
                        ui.label('Game Completion Rate').classes('text-lg font-bold')
                        ui.label(f"{data['gameCompletionRate']:.1f}%").classes('text-2xl mt-2')
        else:
            ui.notify(f'Error fetching engagement metrics: {response.status_code}', type='error')
    except Exception as e:
        ui.notify(f'Error: {str(e)}', type='error')

def fetch_tutorial_dropoff():
    try:
        date = date_input.value
        
        response = requests.get(
            f"{current_api}/getTutorialDropoffStats",
            params={'date': date},
            headers=get_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Create a bar chart for tutorial dropoff
            steps = []
            counts = []
            percentages = []
            
            for step, stats in data['dropoffPoints'].items():
                steps.append(step)
                counts.append(stats['count'])
                percentages.append(stats['percentage'])
            
            fig = go.Figure(data=[
                go.Bar(
                    name='Count',
                    x=steps,
                    y=counts,
                    text=counts,
                    textposition='auto',
                ),
                go.Bar(
                    name='Percentage',
                    x=steps,
                    y=percentages,
                    text=[f'{p:.1f}%' for p in percentages],
                    textposition='auto',
                    yaxis='y2'
                )
            ])
            
            fig.update_layout(
                title=f'Tutorial Dropoff Points (Average Last Step: {data["averageLastStep"]})',
                barmode='group',
                yaxis=dict(
                    title='Number of Players',
                    side='left'
                ),
                yaxis2=dict(
                    title='Percentage',
                    side='right',
                    overlaying='y',
                    ticksuffix='%'
                ),
                height=400,
                width=800,
                margin=dict(l=50, r=50, t=50, b=50)
            )
            
            # Update the plot
            tutorial_plot.clear()
            with tutorial_plot:
                ui.plotly(fig).classes('w-full')
        else:
            ui.notify(f'Error fetching tutorial dropoff stats: {response.status_code}', type='error')
    except Exception as e:
        ui.notify(f'Error: {str(e)}', type='error')

@ui.page('/', response_timeout=30)
async def dashboard():    
    global api_label, player_id_input, actions, players_list, new_players_plot, games_plot, date_input
    global metrics_container, tutorial_plot, fetch_spinner, selected_player_id, player_cards
    
    # Initialize global variables
    selected_player_id = None
    player_cards = {}

    with ui.row().classes('w-full h-full gap-4 p-4'):
        with ui.column().classes('w-1/4 min-w-[250px]'):
            with ui.card().classes('w-full h-[calc(100vh-2rem)]'):
                ui.label('Players').classes('text-xl font-bold mb-2 px-2')
                with ui.scroll_area().classes('w-full h-[calc(100%-3rem)]'):
                    players_list = ui.column().classes('w-full px-2')
        
        with ui.column().classes('flex-grow'):
            ui.label('Legion Dashboard').classes('text-2xl font-bold mb-4')
            
            with ui.row().classes('items-center gap-4'):
                ui.switch('Use Local API', on_change=toggle_api)
                api_label = ui.label(f"Current API: {current_api}")
                ui.label('Show data from:').classes('ml-4')
                date_input = ui.input(value='2024-10-31', placeholder='YYYY-MM-DD')
                date_input.on('change', lambda: [fetch_dashboard_data(), fetch_engagement_metrics()])
            
            # Add the metrics container
            metrics_container = ui.row().classes('w-full mt-4')
            
            # Add tutorial dropoff plot
            # with ui.card().classes('w-full mt-4'):
            #     tutorial_plot = ui.column().classes('w-full')
            
            with ui.row().classes('w-full gap-4 mt-4 flex-wrap'):
                with ui.card().classes('w-[600px]'):
                    new_players_plot = ui.column().classes('w-full')
                with ui.card().classes('w-[600px]'):
                    games_plot = ui.column().classes('w-full')
            
            with ui.row().classes('items-center gap-4 mt-4'):
                player_id_input = ui.input(label='Player ID').classes('flex-grow')
                player_id_input.on('change', fetch_action_log)
                with ui.row().classes('items-center gap-2'):
                    ui.button('Fetch Action Log', on_click=fetch_action_log)
                    fetch_spinner = ui.spinner(size='sm').props('color=primary')
                    fetch_spinner.visible = False

            actions = ui.column().classes('mt-4 w-full')
    
    # Update last visit time and load data
    update_last_visit()
    await load_players()
    await fetch_dashboard_data()
    fetch_engagement_metrics()
    # fetch_tutorial_dropoff()

def format_timestamp(timestamp):
    if isinstance(timestamp, dict):
        seconds = timestamp.get('_seconds')
        if seconds:
            # Convert Unix timestamp to Belgian time
            dt_utc = datetime.fromtimestamp(seconds, pytz.UTC)
            dt_local = dt_utc.astimezone(TIMEZONE)
            return dt_local.strftime('%b %d %H:%M:%S')
    elif isinstance(timestamp, str):
        try:
            # Parse UTC time string and convert to Belgian time
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            dt_utc = dt.replace(tzinfo=pytz.UTC)
            dt_local = dt_utc.astimezone(TIMEZONE)
            return dt_local.strftime('%b %d %H:%M:%S')
        except:
            return timestamp
    return 'N/A'

async def copy_to_clipboard(text: str):
    """Helper function to copy text to clipboard and show notification"""
    await ui.run_javascript(f'navigator.clipboard.writeText("{text}")')
    ui.notify('Player ID copied to clipboard', type='positive')

def format_game_log_entry(entry):
    """Format a single game log entry by removing certain fields and formatting the timestamp"""
    if not isinstance(entry, dict):
        return None, None, str(entry)
    
    # Create a copy to avoid modifying the original
    formatted_entry = entry.copy()
    
    # Extract and format timestamp
    timestamp = None
    if 'timestamp' in formatted_entry:
        timestamp = format_timestamp(formatted_entry['timestamp'])
        formatted_entry.pop('timestamp')
    
    # Extract and format action type
    action_display = None
    details_display = None
    
    if 'actionType' in formatted_entry:
        try:
            action_type = int(formatted_entry['actionType'])
            details = formatted_entry.get('details', {})
            unit_num = details.get('num', '?')  # Get the unit number from details
            
            if action_type == GameAction.MOVE and isinstance(details, dict):
                tile = details.get('tile', {})
                x, y = tile.get('x'), tile.get('y')
                if x is not None and y is not None:
                    action_display = f"[{unit_num}] Moved to {x},{y}"
                    details_display = f"(raw: {details})"
            
            elif action_type == GameAction.ATTACK and isinstance(details, dict):
                target = details.get('target')
                if target is not None:
                    action_display = f"[{unit_num}] Attacked {target}"
                    details_display = f"(raw: {details})"
            
            else:
                # Default case for other action types
                action_str = GAME_ACTION_NAMES.get(action_type, "Unknown action")
                action_display = f"[{unit_num}] {action_str}"
                details_display = f"(raw: {details})"
            
            formatted_entry.pop('actionType')
            formatted_entry.pop('details', None)
            
        except (ValueError, TypeError):
            pass
    
    # Remove fields we want to hide
    formatted_entry.pop('playerId', None)
    formatted_entry.pop('id', None)
    
    # Return remaining JSON only if it contains data other than what we've already displayed
    remaining_json = str(formatted_entry) if formatted_entry and formatted_entry != {} else ""
    
    return timestamp, action_display, details_display or remaining_json

ui.run(port=8050, host='0.0.0.0', reload=True)