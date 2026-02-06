'use client';

import { motion } from 'framer-motion';
import type { WhatIfScenario } from '@tysiac/shared';

interface WhatIfPanelProps {
  scenarios: WhatIfScenario[];
  closeCalls: string[];
}

export function WhatIfPanel({ scenarios, closeCalls }: WhatIfPanelProps) {
  if (scenarios.length === 0 && closeCalls.length === 0) {
    return (
      <div className="text-center text-white/70 py-4">
        No interesting scenarios to report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Close calls */}
      {closeCalls.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
            <span>Close Calls</span>
          </h4>
          <div className="space-y-2">
            {closeCalls.map((call, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-sm text-white/70 bg-table-800/50 rounded p-2 pl-3 border-l-2 border-amber-500/50"
              >
                {call}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* What-if scenarios */}
      {scenarios.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
            <span>What If...?</span>
          </h4>
          <div className="space-y-3">
            {scenarios.map((scenario, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.15 }}
                className="bg-table-800/50 rounded-lg p-3"
              >
                <div className="text-sm text-white/80 mb-1">
                  {scenario.description}
                </div>
                <div className="text-xs text-cyan-400/80 italic">
                  {scenario.hypotheticalOutcome}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
