import React, { useMemo } from 'react';
import ScrollScene from './ScrollScene';
import records from '../../experiments/001-feasibility/calculations.json';
import { placementStates } from './placementStates.mjs';

/**
 * Chapter seven, section two: what sharding divides, and where it stops
 * dividing.
 *
 * The scene climbs a device ladder and reports `placeMemory` at each rung, the
 * same tested function the explorer in §03 runs. Its job is one reversal: for
 * the first few rungs more devices means less memory per device, and then the
 * stored KV heads run out, the cache starts being replicated, and aggregate
 * memory climbs while hardware is still being added.
 */

const WORKLOAD = { model: 'glm-5.3', context: 32768, sequences: 8, kvHeads: 8 };
const gb = bytes => {
  const value = bytes / 1e9;
  return value.toFixed(value < 10 ? 1 : 0);
};

function Stage({ rung, replicating, focus }) {
  const height = bytes => `${Math.min(100 * bytes / rung.capacityPerDevice, 100)}%`;
  return <div className="placement-stage">
    <div className="stage-readout">
      <div className={focus === 'perDevice' ? 'focus focus-perdevice' : ''}>
        <span className="eyebrow">PER DEVICE</span>
        <strong className={rung.fits ? '' : 'alarming'}>{gb(rung.perDeviceBytes)} <small>/ {gb(rung.capacityPerDevice)} GB</small></strong>
      </div>
      <div className={focus === 'cache' ? 'focus focus-cache' : ''}>
        <span className="eyebrow">AGGREGATE CACHE</span>
        <strong className={replicating ? 'climbing' : ''}>{gb(rung.cacheBytesTotal)} <small>GB</small></strong>
      </div>
      <div className={focus === 'sync' ? 'focus focus-sync' : ''}>
        <span className="eyebrow">SYNC / STEP</span>
        <strong>{rung.collectivesPerStep}</strong>
      </div>
    </div>

    <div className="stage-devices">
      <p className="stage-label">
        {rung.devices} {rung.devices === 1 ? 'DEVICE' : 'DEVICES'}
        <b>{rung.kvReplicas > 1 ? `cache replicated ${rung.kvReplicas}×` : 'cache divides exactly'}</b>
      </p>
      <div className="device-grid">
        {Array.from({ length: rung.devices }, (_, i) => <div key={i} className={`device ${rung.fits ? '' : 'over'}`}>
          <div className="device-fill">
            <span className="weight" style={{ height: height(rung.weightBytesPerDevice) }}/>
            <span className={`cache ${replicating ? 'replicated' : ''}`} style={{ height: height(rung.cacheBytesPerDevice) }}/>
          </div>
        </div>)}
      </div>
      <p className="stage-legend">
        <span><i className="weight"/>weights</span>
        <span><i className="cache"/>cache</span>
        <span className="stage-capacity">bar height is share of one device’s capacity</span>
      </p>
    </div>
  </div>;
}

export default function PlacementScene({ figure }) {
  const { ladder, states, turnDevices } = useMemo(
    () => placementStates(WORKLOAD, records), []);
  const rungFor = devices => ladder.find(r => r.devices === devices);

  return <figure className="scene-figure">
    <figcaption className="scene-figure-head">
      <span>One checkpoint, more and more devices</span>
      {figure && <span className="figure-id">FIG. {figure}</span>}
    </figcaption>

    <ScrollScene
      id="placement-scene"
      label="What sharding divides, and where it stops dividing"
      states={states}
      renderStage={state => {
        const rung = rungFor(state.devices);
        return <Stage rung={rung} replicating={rung.devices >= turnDevices} focus={state.focus}/>;
      }}
    />

    <p className="scene-provenance">
      GLM-5.3 under tensor parallelism, eight sequences at 32K tokens, against a
      141 GB device. Every figure is <code>placeMemory</code> evaluated at that
      rung, the same function the explorer below runs. Weights and cache only:
      activations, workspaces and communication buffers are not modelled, and
      chapter one’s third term still applies to every device here.
    </p>
  </figure>;
}
