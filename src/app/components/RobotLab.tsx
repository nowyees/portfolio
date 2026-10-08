import React from 'react';
import SiteShell from './SiteShell';
import AstroTail from './AstroTail';

// Hidden test page (/lab) for the hairline graduation piece before it gets a place on the site.
export default function RobotLab() {
  return (
    <SiteShell active="space">
      <main className="robot-lab">
        <AstroTail className="robot-lab-canvas" />
        <p className="robot-lab-caption"><em>Graduation work</em> — move your cursor</p>
      </main>
    </SiteShell>
  );
}
