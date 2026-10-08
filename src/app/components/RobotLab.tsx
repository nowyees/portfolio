import React from 'react';
import SiteShell from './SiteShell';
import RobotArm from './RobotArm';

// Hidden test page (/lab) for the hairline robot arm before it gets a place on the site.
export default function RobotLab() {
  return (
    <SiteShell active="space">
      <main className="robot-lab">
        <RobotArm className="robot-lab-canvas" />
        <p className="robot-lab-caption"><em>Graduation work</em> — move your cursor</p>
      </main>
    </SiteShell>
  );
}
