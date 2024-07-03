import React, { useEffect, useState } from 'react';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryTooltip, VictoryLabel, VictoryLegend } from 'victory';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import firebaseConfig from '@legion/shared/firebaseConfig';
import { DashboardData, GamesPerModePerDay } from '@legion/shared/dashboardInterfaces';

import { apiFetch } from '../services/apiService';
import './dashboard.css';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function fetchData() {
      const data: DashboardData = await apiFetch('getDashboardData');
      console.log(data);
      setDashboardData(data);
    }

    fetchData();
  }, []);

  let maxUserCount = 0;
  let percentageOfATH = 0;
  let latestUserCount = 0;
  if (dashboardData) {
    maxUserCount = dashboardData?.DAU.length > 0 ? Math.max(...dashboardData.DAU.map(d => d.userCount)) : 0;
    latestUserCount = dashboardData?.DAU.length > 0 ? dashboardData.DAU[dashboardData.DAU.length - 1].userCount : 0;
    percentageOfATH = maxUserCount > 0 ? (latestUserCount / maxUserCount) * 100 : 0;
  }

  // Prepare data for new players per day chart
  const newPlayersData = dashboardData
    ? Object.keys(dashboardData.newPlayersPerDay).map(date => ({
        date,
        newPlayers: dashboardData.newPlayersPerDay[date],
      }))
    : [];

  // Prepare data for games per mode per day chart
  const gamesPerModeData = dashboardData
    ? Object.keys(dashboardData.gamesPerModePerDay).reduce((acc, date) => {
        Object.keys(dashboardData.gamesPerModePerDay[date]).forEach(mode => {
          acc.push({
            date,
            mode,
            count: dashboardData.gamesPerModePerDay[date][mode],
          });
        });
        return acc;
      }, [] as { date: string; mode: string; count: number }[])
    : [];
  console.log(gamesPerModeData);

  return (
    <div className="dashboard-container">
      <div className="chart-container">
        <VictoryChart theme={VictoryTheme.material} domainPadding={20}>
          <VictoryLabel text="DAU" x={225} y={30} textAnchor="middle" style={{ fontSize: 24, fontWeight: 'bold' }} />
          <VictoryLabel
            text={`ATH: ${maxUserCount} | Latest ${percentageOfATH.toFixed(0)}%`}
            x={225}
            y={60}
            textAnchor="middle"
            style={{ fontSize: 16 }}
          />
          <VictoryAxis tickFormat={(x) => new Date(x).toLocaleDateString()} />
          <VictoryAxis dependentAxis tickFormat={(x: number) => Math.round(x).toString()} domain={[0, Math.max(maxUserCount, 5)]} />
          <VictoryLine
            data={dashboardData?.DAU || []}
            x="date"
            y="userCount"
            labels={({ datum }) => `${datum.userCount}`}
            labelComponent={<VictoryTooltip />}
          />
        </VictoryChart>
      </div>
      <div className="chart-container">
        <VictoryChart theme={VictoryTheme.material} domainPadding={20}>
          <VictoryLabel text="New Players Per Day" x={225} y={30} textAnchor="middle" style={{ fontSize: 24, fontWeight: 'bold' }} />
          <VictoryAxis tickFormat={(x) => new Date(x).toLocaleDateString()} />
          <VictoryAxis dependentAxis tickFormat={(x: number) => Math.round(x).toString()} />
          <VictoryLine
            data={newPlayersData}
            x="date"
            y="newPlayers"
            labels={({ datum }) => `${datum.newPlayers}`}
            labelComponent={<VictoryTooltip />}
          />
        </VictoryChart>
      </div>
      <div className="chart-container">
        <VictoryChart theme={VictoryTheme.material} domainPadding={20}>
          <VictoryLabel text="Games Per Mode Per Day" x={225} y={30} textAnchor="middle" style={{ fontSize: 24, fontWeight: 'bold' }} />
          <VictoryLegend x={125} y={50}
            orientation="horizontal"
            gutter={20}
            data={[
              { name: "Mode1", symbol: { fill: "blue" } },
              { name: "Mode2", symbol: { fill: "green" } },
              { name: "Mode3", symbol: { fill: "red" } },
            ]}
          />
          <VictoryAxis tickFormat={(x) => new Date(x).toLocaleDateString()} />
          <VictoryAxis dependentAxis tickFormat={(x: number) => Math.round(x).toString()} />
          {["0", "1", "2"].map(mode => (
            <VictoryLine
              key={mode}
              data={gamesPerModeData.filter(d => d.mode === mode)}
              x="date"
              y="count"
              labels={({ datum }) => `${datum.count}`}
              labelComponent={<VictoryTooltip />}
            />
          ))}
        </VictoryChart>
      </div>
      <b>Total players: {dashboardData?.totalPlayers}</b>
      <div className="retention-container">
        <h3>Day 1 Retention</h3>
        <p>Returning Players: {dashboardData?.day1retention.returningPlayers || 0}</p>
        <p>Retention Rate: {dashboardData?.day1retention.retentionRate.toFixed(2) || 0}%</p>
        <h3>Day 7 Retention</h3>
        <p>Returning Players: {dashboardData?.day7retention.returningPlayers || 0}</p>
        <p>Retention Rate: {dashboardData?.day7retention.retentionRate.toFixed(2) || 0}%</p>
        <h3>Day 30 Retention</h3>
        <p>Returning Players: {dashboardData?.day30retention.returningPlayers || 0}</p>
        <p>Retention Rate: {dashboardData?.day30retention.retentionRate.toFixed(2) || 0}%</p>
        <h3>Yesterday's Retention</h3>
        <p>Returning Players: {dashboardData?.yesterdayRetention.returningPlayers || 0}</p>
        <p>Retention Rate: {dashboardData?.yesterdayRetention.retentionRate.toFixed(2) || 0}%</p>
        <h3>Median Game Duration</h3>
        <p>{dashboardData?.medianGameDuration.toFixed(2) || 0}min.</p>
        <h3>Total Players</h3>
        <p>{dashboardData?.totalPlayers || 0}</p>
      </div>
    </div>
  );
};

export default Dashboard;