import React, { useMemo } from 'react';
import records from '../../experiments/001-feasibility/calculations.json';
import { placeMemory } from './parallel.mjs';

/**
 * Module 14 §29, grammar C: cause, transformation, consequence.
 *
 * The claim is one sentence — more devices solve the capacity problem by
 * introducing a communication problem — and it is made with the real objects
 * rather than with three labels and two arrows. §17 asks for the engineering
 * artifact to carry the explanation where it can, so each stage shows the
 * devices themselves: one that overflows, eight that hold it, and the
 * synchronisation those eight now owe each other every step.
 *
 * Every figure is `placeMemory`, the same tested function the explorer and the
 * scroll scene in this chapter run.
 */

const WORKLOAD = { model: 'glm-5.3', context: 32768, sequences: 8, kvHeads: 8, strategy: 'tp' };
const gb = bytes => {
  const value = bytes / 1e9;
  return value >= 100 ? Math.round(value) : value.toFixed(0);
};

function Devices({ count, rung, over }) {
  // Past a point, drawing every device stops informing and starts decorating.
  const shown = Math.min(count, 8);
  const fill = Math.min(100 * rung.perDeviceBytes / rung.capacityPerDevice, 100);
  return <div className="tradeoff-devices" data-over={over ? 'true' : undefined}>
    {Array.from({ length: shown }, (_, i) => <span key={i} className="tradeoff-device">
      <i style={{ height: `${fill}%` }}/>
    </span>)}
  </div>;
}

export default function Tradeoff() {
  const { one, many } = useMemo(() => ({
    one: placeMemory({ ...WORKLOAD, devices: 1 }, records),
    many: placeMemory({ ...WORKLOAD, devices: 8 }, records),
  }), []);

  return <figure className="tradeoff">
    <ol className="tradeoff-stages">
      <li>
        <span className="tradeoff-number">01</span>
        <b className="tradeoff-name">Capacity</b>
        <span className="tradeoff-question">Does it fit?</span>
        <Devices count={1} rung={one} over/>
        <p className="tradeoff-figure">
          <b>{gb(one.perDeviceBytes)} GB</b>
          <small>on one {gb(one.capacityPerDevice)} GB device</small>
        </p>
        <p className="tradeoff-verdict over">No</p>
      </li>

      <li>
        <span className="tradeoff-number">02</span>
        <b className="tradeoff-name">Sharding</b>
        <span className="tradeoff-question">Split it across eight.</span>
        <Devices count={8} rung={many}/>
        <p className="tradeoff-figure">
          <b>{gb(many.perDeviceBytes)} GB</b>
          <small>each, of the same checkpoint</small>
        </p>
        <p className="tradeoff-verdict">It fits</p>
      </li>

      <li className="consequence">
        <span className="tradeoff-number">03</span>
        <b className="tradeoff-name">Communication</b>
        <span className="tradeoff-question">Now they must agree, every step.</span>
        <div className="tradeoff-collectives" aria-hidden="true">
          {Array.from({ length: many.collectivesPerStep }, (_, i) => <i key={i}/>)}
        </div>
        <p className="tradeoff-figure">
          <b>{many.collectivesPerStep}</b>
          <small>synchronisations per decode step</small>
        </p>
        <p className="tradeoff-verdict cost">New cost</p>
      </li>
    </ol>

    <figcaption className="tradeoff-claim">
      More devices solve the capacity problem by introducing a communication
      problem. The first is paid once, at load; the second is paid again on every
      step, and the slowest rank sets the pace for all of them.
    </figcaption>
  </figure>;
}
