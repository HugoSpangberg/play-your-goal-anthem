import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { demoAnthems } from '../anthems/demoAnthems';
import { type MatchSessionEvent, type MatchSessionSnapshot } from '../matchSessions/matchSessionsApi';
import { useRemoteMatchSession } from '../matchSessions/useRemoteMatchSession';
import { DemoMatchList } from '../matches/DemoMatchList';
import { type DemoMatch, type Team } from '../matches/demoMatchesApi';
import { SpotifyCompanion } from '../spotify/SpotifyCompanion';
import { type SpotifyTrack } from '../spotify/spotifyApi';
import {
  createBrowserScheduler,
  createInitialMatchSnapshot,
  formatMatchClock,
  getDemoMatchEvents,
  MatchSimulationEngine,
  type MatchSnapshot,
  type MatchSpeed,
} from '../matchMode/matchSimulation';
import { parseCuePointInput, formatCuePoint } from './cuePoint';
import { type AnthemSelection, useAnthemPreview } from './anthemPreview';

type SetupDraft = {
  match: DemoMatch;
  supportedTeam?: Team;
  anthemSelection?: AnthemSelection;
  cuePointInput: string;
  spotifyTrack?: SpotifyTrack;
};

type SetupState =
  | { step: 'match'; selectedMatchId?: DemoMatch['id'] }
  | { step: 'team'; draft: SetupDraft }
  | { step: 'anthem'; draft: SetupDraft & { supportedTeam: Team } }
  | { step: 'cue'; draft: SetupDraft & { supportedTeam: Team; anthemSelection: AnthemSelection } }
  | {
      step: 'ready';
      draft: SetupDraft & {
        supportedTeam: Team;
        anthemSelection: AnthemSelection;
        cuePointSeconds: number;
      };
    }
  | {
      step: 'match-mode';
      speed: MatchSpeed;
      draft: SetupDraft & {
        supportedTeam: Team;
        anthemSelection: AnthemSelection;
        cuePointSeconds: number;
      };
    };

type ReadyDraft = Extract<SetupState, { step: 'ready' }>['draft'];

const setupSteps = ['Match', 'Team', 'Anthem', 'Cue point', 'Ready', 'Match mode'] as const;

export function MatchSetupFlow() {
  const [state, setState] = useState<SetupState>({ step: 'match' });

  return (
    <section className="setup-flow" aria-labelledby="setup-flow-title">
      <div className="section-heading">
        <p className="step-label">Setup flow</p>
        <h2 id="setup-flow-title">Prepare your goal anthem</h2>
      </div>

      <ProgressIndicator state={state} />

      {state.step === 'match' ? (
        <DemoMatchList
          selectedMatchId={state.selectedMatchId}
          onMatchSelect={(match) => {
            setState({ step: 'team', draft: { match, cuePointInput: formatCuePoint(0) } });
          }}
        />
      ) : null}

      {state.step === 'team' ? (
        <TeamSelectionStep
          draft={state.draft}
          onBackToMatches={() => setState({ step: 'match', selectedMatchId: state.draft.match.id })}
          onSelectTeam={(supportedTeam) =>
            setState({
              step: 'anthem',
              draft: {
                match: state.draft.match,
                spotifyTrack: state.draft.spotifyTrack,
                supportedTeam,
                cuePointInput: formatCuePoint(0),
              },
            })
          }
        />
      ) : null}

      {state.step === 'anthem' ? (
        <AnthemSelectionStep
          draft={state.draft}
          onBackToTeam={() => setState({ step: 'team', draft: state.draft })}
          onSelectAnthem={(anthemSelection) =>
            setState({
              step: 'cue',
              draft: {
                match: state.draft.match,
                supportedTeam: state.draft.supportedTeam,
                anthemSelection,
                cuePointInput: formatCuePoint(0),
                spotifyTrack: state.draft.spotifyTrack,
              },
            })
          }
          onSelectSpotifyTrack={(spotifyTrack) =>
            setState({
              step: 'anthem',
              draft: {
                ...state.draft,
                spotifyTrack,
              },
            })
          }
        />
      ) : null}

      {state.step === 'cue' ? (
        <CuePointStep
          draft={state.draft}
          onBackToAnthems={() => setState({ step: 'anthem', draft: state.draft })}
          onCuePointInputChange={(cuePointInput) =>
            setState({
              step: 'cue',
              draft: {
                ...state.draft,
                cuePointInput,
              },
            })
          }
          onReady={(cuePointSeconds) =>
            setState({
              step: 'ready',
              draft: {
                ...state.draft,
                cuePointSeconds,
              },
            })
          }
        />
      ) : null}

      {state.step === 'ready' ? (
        <ReadyStep
          draft={state.draft}
          onStartMatch={(speed) =>
            setState({
              step: 'match-mode',
              draft: state.draft,
              speed,
            })
          }
          onBackToCuePoint={() =>
            setState({
              step: 'cue',
              draft: {
                match: state.draft.match,
                supportedTeam: state.draft.supportedTeam,
                anthemSelection: state.draft.anthemSelection,
                cuePointInput: formatCuePoint(state.draft.cuePointSeconds),
                spotifyTrack: state.draft.spotifyTrack,
              },
            })
          }
        />
      ) : null}

      {state.step === 'match-mode' ? (
        <MatchModeStep
          draft={state.draft}
          speed={state.speed}
          onEndMatchMode={() =>
            setState({
              step: 'ready',
              draft: state.draft,
            })
          }
        />
      ) : null}
    </section>
  );
}

type ProgressIndicatorProps = {
  state: SetupState;
};

const stepIndexByState: Record<SetupState['step'], number> = {
  match: 0,
  team: 1,
  anthem: 2,
  cue: 3,
  ready: 4,
  'match-mode': 5,
};

function ProgressIndicator({ state }: ProgressIndicatorProps) {
  return (
    <ol className="progress-indicator" aria-label="Setup progress">
      {setupSteps.map((step, index) => {
        const status = getProgressStatus(state, index);

        return (
          <li aria-current={status === 'current' ? 'step' : undefined} className="progress-step" data-status={status} key={step}>
            <span className="progress-step__index">{index + 1}</span>
            <span className="progress-step__name">{step}</span>
            <span className="progress-step__state">{progressStatusLabel[status]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function getProgressStatus(state: SetupState, stepIndex: number) {
  const currentStepIndex = stepIndexByState[state.step];

  if (stepIndex < currentStepIndex) {
    return 'completed';
  }

  if (stepIndex === currentStepIndex) {
    return 'current';
  }

  return 'upcoming';
}

const progressStatusLabel = {
  completed: 'Done',
  current: 'Current',
  upcoming: 'Planned',
} as const;

type TeamSelectionStepProps = {
  draft: SetupDraft;
  onBackToMatches: () => void;
  // eslint-disable-next-line no-unused-vars
  onSelectTeam: (supportedTeam: Team) => void;
};

function TeamSelectionStep({ draft, onBackToMatches, onSelectTeam }: TeamSelectionStepProps) {
  const selectedTeamId = draft.supportedTeam?.id;

  return (
    <section className="setup-section" aria-labelledby="team-selection-title">
      <div className="section-heading setup-section__header">
        <div className="setup-section__copy">
          <p className="step-label">Choose team</p>
          <h3 id="team-selection-title">Which team do you support in this match?</h3>
          <p className="setup-section__summary">
            {draft.match.homeTeam.name} vs {draft.match.awayTeam.name}
          </p>
        </div>
        <button className="secondary-action" onClick={onBackToMatches} type="button">
          Back to matches
        </button>
      </div>

      <div className="team-grid" role="group" aria-labelledby="team-selection-title">
        {[draft.match.homeTeam, draft.match.awayTeam].map((team) => {
          const isSelected = selectedTeamId === team.id;

          return (
            <button
              key={team.id}
              className="team-card"
              data-selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelectTeam(team)}
              type="button"
            >
              <span className="team-card__label">{team.name}</span>
              <span className="team-card__status">{isSelected ? 'Selected team' : 'Select this team'}</span>
            </button>
          );
        })}
      </div>

      <p className="setup-section__note" aria-live="polite">
        {draft.supportedTeam
          ? `${draft.supportedTeam.name} is selected. Anthem selection is the next planned step.`
          : 'Select one team to continue to anthem selection.'}
      </p>
    </section>
  );
}

type AnthemSelectionStepProps = {
  draft: SetupDraft & { supportedTeam: Team };
  onBackToTeam: () => void;
  // eslint-disable-next-line no-unused-vars
  onSelectAnthem: (anthemSelection: AnthemSelection) => void;
  // eslint-disable-next-line no-unused-vars
  onSelectSpotifyTrack: (spotifyTrack: SpotifyTrack) => void;
};

function AnthemSelectionStep({ draft, onBackToTeam, onSelectAnthem, onSelectSpotifyTrack }: AnthemSelectionStepProps) {
  const selectedDemoAnthemId = draft.anthemSelection?.kind === 'demo' ? draft.anthemSelection.anthem.id : undefined;

  return (
    <section className="setup-section" aria-labelledby="anthem-selection-title">
      <div className="section-heading setup-section__header">
        <div className="setup-section__copy">
          <p className="step-label">Choose anthem</p>
          <h3 id="anthem-selection-title">Select a demo anthem or use a local audio file</h3>
          <p className="setup-section__summary">
            Supported team: {draft.supportedTeam.name}. Cue point setup comes next.
          </p>
        </div>
        <button className="secondary-action" onClick={onBackToTeam} type="button">
          Back to team
        </button>
      </div>

      <div className="anthem-grid">
        {demoAnthems.map((anthem) => (
          <button
            key={anthem.id}
            className="anthem-card"
            data-selected={selectedDemoAnthemId === anthem.id}
            aria-pressed={selectedDemoAnthemId === anthem.id}
            type="button"
            onClick={() => onSelectAnthem({ kind: 'demo', anthem })}
          >
            <span className="anthem-card__name">{anthem.name}</span>
            <span className="anthem-card__meta">{anthem.description}</span>
            <span className="anthem-card__footer">{formatCuePoint(anthem.durationSeconds)} total duration</span>
          </button>
        ))}
      </div>

      <div className="local-audio-card">
        <div className="local-audio-card__copy">
          <p className="step-label">Local file</p>
          <p className="local-audio-card__title">Use an audio file from your device</p>
          <p className="local-audio-card__note">The file stays in your browser and is never uploaded.</p>
        </div>

        <label className="file-picker">
          <span>Choose audio file</span>
          <input
            accept="audio/*"
            aria-label="Choose a local audio file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                onSelectAnthem({ kind: 'local', file });
              }
            }}
            type="file"
          />
        </label>
      </div>

      {draft.anthemSelection?.kind === 'local' ? (
        <p className="setup-section__note" aria-live="polite">
          Current selection: {draft.anthemSelection.file.name}
        </p>
      ) : null}

      {draft.anthemSelection ? (
        <p className="setup-section__note" aria-live="polite">
          Selected anthem: {describeAnthemSelection(draft.anthemSelection)}
        </p>
      ) : (
        <p className="setup-section__note" aria-live="polite">
          Choose one anthem to continue to cue point setup.
        </p>
      )}

      <SpotifyCompanion onSelectTrack={onSelectSpotifyTrack} selectedTrack={draft.spotifyTrack} />
    </section>
  );
}

type CuePointStepProps = {
  draft: SetupDraft & { supportedTeam: Team; anthemSelection: AnthemSelection };
  onBackToAnthems: () => void;
  // eslint-disable-next-line no-unused-vars
  onCuePointInputChange: (cuePointInput: string) => void;
  // eslint-disable-next-line no-unused-vars
  onReady: (cuePointSeconds: number) => void;
};

function CuePointStep({ draft, onBackToAnthems, onCuePointInputChange, onReady }: CuePointStepProps) {
  const { audioRef, durationSeconds, handleLoadedMetadata, playFromCue, preview, stopPreview } = useAnthemPreview(
    draft.anthemSelection,
  );
  const cuePointValidation = parseCuePointInput(draft.cuePointInput, durationSeconds ?? null);
  const cuePointError = cuePointValidation.error;
  const cuePointSeconds = cuePointValidation.cuePointSeconds;

  return (
    <section className="setup-section" aria-labelledby="cue-point-title">
      <div className="section-heading setup-section__header">
        <div className="setup-section__copy">
          <p className="step-label">Cue point</p>
          <h3 id="cue-point-title">Set where the anthem should begin</h3>
          <p className="setup-section__summary">
            {describeAnthemSelection(draft.anthemSelection)} for {draft.supportedTeam.name}
          </p>
        </div>
        <button
          className="secondary-action"
          onClick={() => {
            stopPreview();
            onBackToAnthems();
          }}
          type="button"
        >
          Back to anthems
        </button>
      </div>

      <div className="cue-layout">
        <div className="cue-panel">
          <p className="cue-panel__label">Preview</p>
          <audio
            aria-label="Preview selected anthem"
            controls
            onLoadedMetadata={handleLoadedMetadata}
            preload="metadata"
            ref={audioRef}
            src={preview?.audioUrl ?? undefined}
          />
          <p className="cue-panel__meta">{preview ? `${preview.sourceLabel}: ${preview.label}` : 'Audio preview loading.'}</p>
          <p className="cue-panel__meta">
            {durationSeconds !== null ? `Duration: ${formatCuePoint(durationSeconds)}` : 'Duration loads after the file is ready.'}
          </p>
          <button
            className="secondary-action"
            disabled={cuePointSeconds === null || cuePointError !== undefined || preview === null}
            onClick={() => {
              if (cuePointSeconds === null) {
                return;
              }

              void playFromCue(cuePointSeconds);
            }}
            type="button"
          >
            Test anthem
          </button>
        </div>

        <div className="cue-panel">
          <p className="cue-panel__label">Cue point</p>
          <label className="cue-input">
            <span>Start position in mm:ss</span>
            <input
              aria-describedby="cue-point-help cue-point-error"
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => onCuePointInputChange(event.currentTarget.value)}
              placeholder="00:00"
              type="text"
              value={draft.cuePointInput}
            />
          </label>
          <p className="cue-panel__help" id="cue-point-help">
            Use the current playback position or type a new cue point.
          </p>
          <button
            className="secondary-action"
            disabled={preview === null}
            onClick={() => {
              const currentTimeSeconds = audioRef.current ? Math.max(0, Math.floor(audioRef.current.currentTime)) : 0;
              onCuePointInputChange(formatCuePoint(currentTimeSeconds));
            }}
            type="button"
          >
            Use current playback position
          </button>
          {cuePointError ? (
            <p className="cue-panel__error" id="cue-point-error" role="alert">
              {cuePointError}
            </p>
          ) : (
            <p className="cue-panel__error cue-panel__error--quiet" id="cue-point-error">
              Cue points must stay within the track duration.
            </p>
          )}
          <button
            className="primary-action"
            disabled={cuePointSeconds === null}
            onClick={() => {
              if (cuePointSeconds === null) {
                return;
              }

              onReady(cuePointSeconds);
            }}
            type="button"
          >
            Mark ready
          </button>
        </div>
      </div>
    </section>
  );
}

type ReadyStepProps = {
  draft: ReadyDraft;
  onBackToCuePoint: () => void;
  // eslint-disable-next-line no-unused-vars
  onStartMatch: (speed: MatchSpeed) => void;
};

function ReadyStep({ draft, onBackToCuePoint, onStartMatch }: ReadyStepProps) {
  const [speed, setSpeed] = useState<MatchSpeed>('demo');

  return (
    <section className="setup-section setup-section--ready" aria-labelledby="ready-title">
      <div className="section-heading setup-section__header">
        <div className="setup-section__copy">
          <p className="step-label">Ready</p>
          <h3 id="ready-title">Your setup is ready</h3>
          <p className="setup-section__summary">The selected choices are stored only in this browser session.</p>
        </div>
        <button className="secondary-action" onClick={onBackToCuePoint} type="button">
          Back to cue point
        </button>
      </div>

      <dl className="ready-summary">
        <div className="ready-summary__row">
          <dt>Match</dt>
          <dd>
            {draft.match.homeTeam.name} vs {draft.match.awayTeam.name}
          </dd>
        </div>
        <div className="ready-summary__row">
          <dt>Supported team</dt>
          <dd>{draft.supportedTeam.name}</dd>
        </div>
        <div className="ready-summary__row">
          <dt>Anthem</dt>
          <dd>{describeAnthemSelection(draft.anthemSelection)}</dd>
        </div>
        <div className="ready-summary__row">
          <dt>Spotify companion track</dt>
          <dd>{draft.spotifyTrack ? `${draft.spotifyTrack.name} by ${draft.spotifyTrack.artists}` : 'None'}</dd>
        </div>
        <div className="ready-summary__row">
          <dt>Cue point</dt>
          <dd>{formatCuePoint(draft.cuePointSeconds)}</dd>
        </div>
      </dl>

      <fieldset className="speed-options">
        <legend>Match speed</legend>
        <label>
          <input
            checked={speed === 'demo'}
            name="match-speed"
            onChange={() => setSpeed('demo')}
            type="radio"
          />
          Demo speed (15x)
        </label>
        <label>
          <input
            checked={speed === 'normal'}
            name="match-speed"
            onChange={() => setSpeed('normal')}
            type="radio"
          />
          Normal speed (1x)
        </label>
      </fieldset>

      <button className="primary-action primary-action--large" onClick={() => onStartMatch(speed)} type="button">
        Start match
      </button>
    </section>
  );
}

type MatchModeStepProps = {
  draft: ReadyDraft;
  onEndMatchMode: () => void;
  speed: MatchSpeed;
};

function MatchModeStep({ draft, onEndMatchMode, speed }: MatchModeStepProps) {
  const [mode, setMode] = useState<'remote' | 'local'>('remote');
  const [retryKey, setRetryKey] = useState(0);

  if (mode === 'local') {
    return <LocalMatchModeStep draft={draft} onEndMatchMode={onEndMatchMode} speed={speed} />;
  }

  return (
    <RemoteMatchModeStep
      key={retryKey}
      draft={draft}
      onBack={onEndMatchMode}
      onEndMatchMode={onEndMatchMode}
      onRetry={() => setRetryKey((current) => current + 1)}
      onUseLocalFallback={() => setMode('local')}
      speed={speed}
    />
  );
}

type RemoteMatchModeStepProps = {
  draft: ReadyDraft;
  onBack: () => void;
  onEndMatchMode: () => void;
  onRetry: () => void;
  onUseLocalFallback: () => void;
  speed: MatchSpeed;
};

function RemoteMatchModeStep({ draft, onBack, onEndMatchMode, onRetry, onUseLocalFallback, speed }: RemoteMatchModeStepProps) {
  const { match, supportedTeam, anthemSelection, cuePointSeconds } = draft;
  const { audioRef, playFromCue, preview, stopPreview } = useAnthemPreview(anthemSelection);
  const [lastAnthemStatus, setLastAnthemStatus] = useState('Waiting for a supported-team goal.');
  const onNewSupportedTeamGoal = useCallback(
    (event: MatchSessionEvent) => {
      setLastAnthemStatus(`Playing anthem for ${event.label}.`);
      void playFromCue(cuePointSeconds);
    },
    [cuePointSeconds, playFromCue],
  );
  const { endSession, error, snapshot, status } = useRemoteMatchSession({
    match,
    onNewSupportedTeamGoal,
    speed,
    supportedTeamId: supportedTeam.id,
  });

  if (status === 'unavailable') {
    return (
      <section className="match-mode" aria-labelledby="match-mode-title">
        <div className="section-heading setup-section__header">
          <div className="setup-section__copy">
            <p className="step-label">Remote match mode</p>
            <h3 id="match-mode-title">Remote match mode is unavailable</h3>
            <p className="setup-section__summary">{error ?? 'The backend match session could not be started.'}</p>
          </div>
        </div>
        <div className="match-controls">
          <button className="primary-action" onClick={onRetry} type="button">
            Try again
          </button>
          <button className="secondary-action" onClick={onUseLocalFallback} type="button">
            Use local demo mode
          </button>
          <button className="secondary-action" onClick={onBack} type="button">
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <MatchModeView
      audioRef={audioRef}
      connectionStatus={status}
      lastAnthemStatus={lastAnthemStatus}
      match={match}
      onEndMatchMode={() => {
        void endSession().finally(() => {
          stopPreview();
          onEndMatchMode();
        });
      }}
      onManualPlayback={() => {
        setLastAnthemStatus('Manual goal playback started.');
        void playFromCue(cuePointSeconds);
      }}
      onStopPlayback={() => {
        stopPreview();
        setLastAnthemStatus('Anthem stopped.');
      }}
      previewUrl={preview?.audioUrl}
      snapshot={snapshot}
      speed={speed}
      supportedTeamName={supportedTeam.name}
      spotifyTrack={draft.spotifyTrack}
    />
  );
}

function LocalMatchModeStep({ draft, onEndMatchMode, speed }: MatchModeStepProps) {
  const { match, supportedTeam, anthemSelection, cuePointSeconds } = draft;
  const { audioRef, playFromCue, preview, stopPreview } = useAnthemPreview(anthemSelection);
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() => createInitialMatchSnapshot());
  const [lastAnthemStatus, setLastAnthemStatus] = useState('Waiting for a supported-team goal.');
  const [lastSyncStatus, setLastSyncStatus] = useState('Kickoff synchronized from Start match.');
  const engineRef = useRef<MatchSimulationEngine | null>(null);

  useEffect(() => {
    const engine = new MatchSimulationEngine({
      events: getDemoMatchEvents(match),
      match,
      scheduler: createBrowserScheduler(),
      speed,
      supportedTeamId: supportedTeam.id,
      onGoalForSupportedTeam: (event) => {
        setLastAnthemStatus(`Playing anthem for ${event.label}.`);
        void playFromCue(cuePointSeconds);
      },
      onSnapshot: (nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setLastSyncStatus(
          nextSnapshot.status === 'ended'
            ? 'Full-time reached in the deterministic match.'
            : `Synchronized at ${formatMatchClock(nextSnapshot.elapsedSeconds)} from local kickoff.`,
        );
      },
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
      stopPreview();
    };
  }, [cuePointSeconds, match, playFromCue, speed, stopPreview, supportedTeam.id]);

  return (
    <MatchModeView
      audioRef={audioRef}
      connectionStatus="connected"
      lastAnthemStatus={lastAnthemStatus}
      match={match}
      onEndMatchMode={() => {
        engineRef.current?.stop();
        stopPreview();
        onEndMatchMode();
      }}
      onManualPlayback={() => {
        setLastAnthemStatus('Manual goal playback started.');
        void playFromCue(cuePointSeconds);
      }}
      onStopPlayback={() => {
        stopPreview();
        setLastAnthemStatus('Anthem stopped.');
      }}
      previewUrl={preview?.audioUrl}
      snapshot={snapshot}
      speed={speed}
      supportedTeamName={supportedTeam.name}
      spotifyTrack={draft.spotifyTrack}
      syncStatus={lastSyncStatus}
    />
  );
}

function MatchModeView({
  audioRef,
  connectionStatus,
  lastAnthemStatus,
  match,
  onEndMatchMode,
  onManualPlayback,
  onStopPlayback,
  previewUrl,
  snapshot,
  speed,
  spotifyTrack,
  supportedTeamName,
  syncStatus,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  connectionStatus: string;
  lastAnthemStatus: string;
  match: DemoMatch;
  onEndMatchMode: () => void;
  onManualPlayback: () => void;
  onStopPlayback: () => void;
  previewUrl?: string;
  snapshot: MatchSnapshot | MatchSessionSnapshot | null;
  speed: MatchSpeed;
  spotifyTrack?: SpotifyTrack;
  supportedTeamName: string;
  syncStatus?: string;
}) {
  const currentSnapshot = snapshot ?? createInitialMatchSnapshot();

  return (
    <section className="match-mode" aria-labelledby="match-mode-title">
      <div className="section-heading setup-section__header">
        <div className="setup-section__copy">
          <p className="step-label">Live match mode</p>
          <h3 id="match-mode-title">Match mode</h3>
          <p className="setup-section__summary">
            {match.homeTeam.name} vs {match.awayTeam.name}
          </p>
        </div>
        <button className="secondary-action" onClick={onEndMatchMode} type="button">
          End match mode
        </button>
      </div>

      <audio aria-label="Match anthem playback" preload="metadata" ref={audioRef} src={previewUrl} />

      <div className="scoreboard" aria-live="polite">
        <div className="scoreboard__team">
          <span>{match.homeTeam.name}</span>
          <strong>{currentSnapshot.homeScore}</strong>
        </div>
        <div className="scoreboard__clock">
          <span>Clock</span>
          <strong>{formatMatchClock(currentSnapshot.elapsedSeconds)}</strong>
          <span>{formatMatchStatus(currentSnapshot.status)}</span>
        </div>
        <div className="scoreboard__team">
          <span>{match.awayTeam.name}</span>
          <strong>{currentSnapshot.awayScore}</strong>
        </div>
      </div>

      <dl className="match-status-grid">
        <div>
          <dt>Supported team</dt>
          <dd>{supportedTeamName}</dd>
        </div>
        <div>
          <dt>Anthem status</dt>
          <dd>{lastAnthemStatus}</dd>
        </div>
        <div>
          <dt>Sync status</dt>
          <dd>{syncStatus ?? formatConnectionStatus(connectionStatus)}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{speed === 'demo' ? 'Demo speed (15x)' : 'Normal speed (1x)'}</dd>
        </div>
        <div>
          <dt>Spotify companion</dt>
          <dd>
            {spotifyTrack ? (
              <a href={spotifyTrack.externalUrl} rel="noreferrer" target="_blank">
                {spotifyTrack.name} by {spotifyTrack.artists}
              </a>
            ) : (
              'None'
            )}
          </dd>
        </div>
      </dl>

      <div className="match-controls">
        <button className="primary-action primary-action--large" onClick={onManualPlayback} type="button">
          Goal! Play anthem now
        </button>
        <button className="secondary-action" onClick={onStopPlayback} type="button">
          Stop anthem
        </button>
      </div>

      <section aria-labelledby="timeline-title" className="timeline-panel">
        <h4 id="timeline-title">Match timeline</h4>
        {currentSnapshot.timeline.length > 0 ? (
          <ol>
            {currentSnapshot.timeline.map((event) => (
              <li key={event.id}>
                <span>{formatMatchClock(event.atSecond)}</span>
                <span>{event.label}</span>
                <strong>
                  {event.homeScore}-{event.awayScore}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>No match events processed yet.</p>
        )}
      </section>
    </section>
  );
}

function describeAnthemSelection(selection: AnthemSelection) {
  return selection.kind === 'demo' ? selection.anthem.name : `Local file: ${selection.file.name}`;
}

function formatMatchStatus(status: MatchSnapshot['status']) {
  switch (status) {
    case 'half-time':
      return 'Half-time';
    case 'ended':
      return 'Full-time';
    case 'live':
      return 'Live';
    default:
      return 'Waiting';
  }
}

function formatConnectionStatus(status: string) {
  switch (status) {
    case 'starting':
      return 'Starting backend match session.';
    case 'connecting':
      return 'Connecting to match stream.';
    case 'connected':
      return 'Connected to backend match stream.';
    case 'reconnecting':
      return 'Reconnecting to match stream.';
    case 'disconnected':
      return 'Disconnected from match stream.';
    case 'ended':
      return 'Match session ended.';
    default:
      return 'Match stream unavailable.';
  }
}
