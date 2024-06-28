import React, { useEffect, useState } from 'react';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryTooltip, VictoryLabel } from 'victory';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import firebaseConfig from '@legion/shared/firebaseConfig';
import { DAUData } from '@legion/shared/dashboardInterfaces';

import { apiFetch } from '../services/apiService';
import './dashboard.css';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const Dashboard: React.FC = () => {
  const [dauData, setDauData] = useState<DAUData[]>([]);

  useEffect(() => {
    async function fetchData() {
      const data: DAUData[] = await apiFetch('getDAUData');
      setDauData(data);
    }

    fetchData();
  }, []);

  const maxUserCount = dauData.length > 0 ? Math.max(...dauData.map(d => d.userCount)) : 0;
  const latestUserCount = dauData.length > 0 ? dauData[dauData.length - 1].userCount : 0;
  const percentageOfATH = maxUserCount > 0 ? (latestUserCount / maxUserCount) * 100 : 0;

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
            data={dauData}
            x="date"
            y="userCount"
            labels={({ datum }) => `${datum.userCount}`}
            labelComponent={<VictoryTooltip />}
          />
        </VictoryChart>
      </div>
    </div>
  );
};

export default Dashboard;
