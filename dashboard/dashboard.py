import os
import requests
import pandas as pd
from dotenv import load_dotenv
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from IPython.display import display
from datetime import datetime, timedelta
from matplotlib.ticker import MaxNLocator
from colorama import Fore, Style
import pprint

load_dotenv()

API_URL = os.getenv('API_URL')
plt.style.use('dark_background')
pp = pprint.PrettyPrinter(indent=4)
class DashboardData:
    _instance = None
    _data = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._data is None:
            self._data = self.fetch_data()
            print(self._data)
            self.dau = self._data['DAU']
            self.total_players = self._data['totalPlayers']
            self.day1_retention = self._data['day1retention']
            self.day7_retention = self._data['day7retention']
            self.day30_retention = self._data['day30retention']
            self.yesterday_retention = self._data['yesterdayRetention']
            self.new_players_per_day = self._data['newPlayersPerDay']
            self.games_per_mode_per_day = self._data['gamesPerModePerDay']
            self.median_game_duration = self._data['medianGameDuration']
            self.inactive_player_ids = self._data['inactivePlayerIds']

    @classmethod
    def fetch_data(cls):
        print("Making API call")
        response = requests.get(f"{API_URL}/getDashboardData")
        return response.json()
    
    
    def generate_date_range(self, start_date, end_date):
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        delta = timedelta(days=1)
        dates = []
        while start <= end:
            dates.append(start.strftime('%Y-%m-%d'))
            start += delta
        return dates
    
    def prepare_dau_data(self):
        dau_data = [{'date': entry['date'], 'userCount': entry['userCount']} for entry in self.dau]
        if dau_data:
            start_date = dau_data[0]['date']
            end_date = datetime.now().strftime('%Y-%m-%d')
            complete_dates = self.generate_date_range(start_date, end_date)
            
            dau_dict = {entry['date']: entry['userCount'] for entry in dau_data}
            complete_data = [{'date': date, 'userCount': dau_dict.get(date, 0)} for date in complete_dates]
            return complete_data
        return []

    def prepare_new_players_data(self):
        print(f"In: {self.new_players_per_day}")
        new_players_data = [{'date': date, 'newPlayers': count} for date, count in self.new_players_per_day.items()]
        if new_players_data:
            start_date = new_players_data[0]['date']
            end_date = datetime.now().strftime('%Y-%m-%d')
            complete_dates = self.generate_date_range(start_date, end_date)
            
            new_players_dict = {entry['date']: entry['newPlayers'] for entry in new_players_data}
            complete_data = [{'date': date, 'newPlayers': new_players_dict.get(date, 0)} for date in complete_dates]
            print(f"Out: {complete_data}")
            return complete_data
        return []

    def prepare_games_per_mode_data(self):
        games_per_mode_data = []
        for date, modes in self.games_per_mode_per_day.items():
            for mode, count in modes.items():
                games_per_mode_data.append({'date': date, 'mode': mode, 'count': count})
        
        if games_per_mode_data:
            start_date = min(entry['date'] for entry in games_per_mode_data)
            end_date = datetime.now().strftime('%Y-%m-%d')
            complete_dates = self.generate_date_range(start_date, end_date)
            
            mode_set = {entry['mode'] for entry in games_per_mode_data}
            games_dict = {(entry['date'], entry['mode']): entry['count'] for entry in games_per_mode_data}
            complete_data = [
                {'date': date, 'mode': mode, 'count': games_dict.get((date, mode), 0)}
                for date in complete_dates for mode in mode_set
            ]
            return complete_data
        return []


def plot_dau_and_new_players():
    data = DashboardData()
    
    # Prepare DAU data with interpolated dates
    dau_data = data.prepare_dau_data()
    print(dau_data)
    dau_dates = [datetime.strptime(entry['date'], '%Y-%m-%d') for entry in dau_data]
    dau_user_counts = [entry['userCount'] for entry in dau_data]
    
    # Prepare new players data with interpolated dates
    new_players_data = data.prepare_new_players_data()
    print(new_players_data)
    new_players_dates = [datetime.strptime(entry['date'], '%Y-%m-%d') for entry in new_players_data]
    new_players_counts = [entry['newPlayers'] for entry in new_players_data]
    
    # Create subplots
    fig, axes = plt.subplots(nrows=1, ncols=2, figsize=(15, 5))
    
    # Plot DAU
    axes[0].plot(dau_dates, dau_user_counts, label='DAU')
    axes[0].set_title('Daily Active Users (DAU)')
    axes[0].set_xlabel('Date')
    axes[0].set_ylabel('User Count')
    axes[0].tick_params(axis='x', rotation=45)
    axes[0].yaxis.set_major_locator(MaxNLocator(integer=True))
    axes[0].xaxis.set_major_formatter(mdates.DateFormatter('%d-%m'))
    axes[0].legend()
    
    # Plot New Players Per Day
    axes[1].plot(new_players_dates, new_players_counts, label='New Players Per Day')
    axes[1].set_title('New Players Per Day')
    axes[1].set_xlabel('Date')
    axes[1].set_ylabel('New Players')
    axes[1].tick_params(axis='x', rotation=45)
    axes[1].set_ylim(0, max(new_players_counts) + 1)
    axes[1].set_yticks(range(0, max(new_players_counts) + 2))
    axes[1].yaxis.set_major_locator(MaxNLocator(integer=True))
    axes[1].xaxis.set_major_formatter(mdates.DateFormatter('%d-%m'))
    axes[1].legend()
    
    plt.tight_layout()
    plt.show()

def plot_games_per_mode():
    data = DashboardData()
    
    # Prepare games per mode data with interpolated dates
    games_per_mode_data = data.prepare_games_per_mode_data()
    df = pd.DataFrame(games_per_mode_data)
    df['date'] = pd.to_datetime(df['date'])
    
    modes = df['mode'].unique()
    mode_labels = {'0': 'Practice', '1': 'Casual', '2': 'Ranked'}
    mode_colors = {'0': 'blue', '1': 'green', '2': 'red'}
    
    plt.figure(figsize=(6, 3))
    for mode in modes:
        mode_data = df[df['mode'] == mode]
        plt.plot(mode_data['date'], mode_data['count'], label=mode_labels.get(mode, f'Mode {mode}'), color=mode_colors.get(mode, 'black'))
    
    plt.title('Games Per Mode Per Day')
    plt.xlabel('Date')
    plt.ylabel('Games Count')
    plt.xticks(rotation=45)
    plt.gca().yaxis.set_major_locator(MaxNLocator(integer=True))
    plt.gca().xaxis.set_major_locator(mdates.DayLocator())
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%d-%m'))
    plt.legend()
    plt.show()

def display_retention_table():
    data = DashboardData()
    retention_data = {
        "Retention Period": ["Day 1", "Day 7", "Day 30", "Yesterday"],
        "Returning Players": [
            data.day1_retention['returningPlayers'],
            data.day7_retention['returningPlayers'],
            data.day30_retention['returningPlayers'],
            data.yesterday_retention['returningPlayers']
        ],
        "Retention Rate (%)": [
            data.day1_retention['retentionRate'],
            data.day7_retention['retentionRate'],
            data.day30_retention['retentionRate'],
            data.yesterday_retention['retentionRate']
        ]
    }
    retention_df = pd.DataFrame(retention_data)
    display(retention_df)

def print_additional_info():
    data = DashboardData()

    # Calculate ATH of DAU
    dau_data = data.prepare_dau_data()
    ath_dau = max(entry['userCount'] for entry in dau_data)

    # Get yesterday's DAU
    yesterday_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    yesterday_dau = next((entry['userCount'] for entry in dau_data if entry['date'] == yesterday_date), 0)

    # Calculate the percentage of ATH
    percentage_of_ath = (yesterday_dau / ath_dau) * 100 if ath_dau > 0 else 0

    print(f"Median Game Duration: {data.median_game_duration:.2f} min")
    print(f"Total Players: {data.total_players}")
    print(f"ATH of DAU: {ath_dau}")
    print(f"Yesterday's DAU: {yesterday_dau} ({percentage_of_ath:.2f}% of ATH)")

def get_player_log(player_id):
    endpoint = f"{API_URL}/getActionLog?playerId={player_id}"
    try:
        response = requests.get(endpoint)
        response.raise_for_status()  # Raise an HTTPError for bad responses
        data = response.json()
        pretty_print_action_log(data['actionLog'])
        pretty_print_player_summary(data['playerSummary'])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching action log for player {player_id}: {e}")

def pretty_print_action_log(action_log):
    for entry in action_log:
        timestamp = datetime.fromtimestamp(entry['timestamp']['_seconds']).strftime('%m-%d %H:%M:%S')
        action_type = entry['actionType']
        details = entry['details']
        print(f"{Fore.CYAN}{timestamp} - {Fore.GREEN}{action_type} - {Style.RESET_ALL}")
        pp.pprint(details)
        print(Style.RESET_ALL)

def pretty_print_player_summary(player_summary):
    print("\nPlayer Summary:")
    print(f"Gold: {player_summary['gold']}")
    print(f"Rank: {player_summary['rank']}")
    print(f"All Time Rank: {player_summary['allTimeRank']}")
    print(f"Losses streak: {player_summary['lossesStreak']}")
    print("\nCharacters:")
    for character in player_summary['characters']:
        print(f"  Character ID: {character['id']}")
        print(f"    Level: {character['level']}")
        print(f"    XP: {character['xp']}")
        print(f"    SP: {character['sp']}")
        print(f"    All Time SP: {character['allTimeSP']}")
        print(f"    Skills: {character['skills']}")
        print(f"    Inventory: {character['inventory']}")
        print(f"    Equipment: {character['equipment']}")
        print()


def get_game_log(game_id):
    endpoint = f"{API_URL}/getGameLog?gameId={game_id}"
    try:
        response = requests.get(endpoint)
        response.raise_for_status()  # Raise an HTTPError for bad responses
        data = response.json()
        pretty_print_game_log(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching game log for game {game_id}: {e}")

def pretty_print_game_log(game_log):
    for entry in game_log:
        timestamp = datetime.fromtimestamp(entry['timestamp']['_seconds']).strftime('%m-%d %H:%M:%S')
        action_type = entry['actionType']
        details = entry['details']
        print(f"{Fore.CYAN}{timestamp} - {Fore.GREEN}{action_type} - {Style.RESET_ALL}")
        pp.pprint(details)
        print(Style.RESET_ALL)

def list_inactive_players():
    data = DashboardData()
    if data.inactive_player_ids:
        print(f"Inactive Players (Total: {len(data.inactive_player_ids)}):")
        for player_id in data.inactive_player_ids:
            print(player_id)
    else:
        print("No inactive players found.")