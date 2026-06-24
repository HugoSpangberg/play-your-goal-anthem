import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { getSafePixabaySourceUrl, getSourceTypeLabel, validateLocalAudioFile, validatePixabayMusicUrl, type LocalAudioSourceMetadata } from '../anthems/localAudioSource';
import { PixabayMusicGuide } from '../anthems/PixabayMusicGuide';
import { type MatchSessionEvent, type MatchSessionSnapshot } from '../matchSessions/matchSessionsApi';
import { useRemoteMatchSession } from '../matchSessions/useRemoteMatchSession';
import { CountryFlag } from '../matches/CountryFlag';
import { DemoMatchList } from '../matches/DemoMatchList';
import { type DemoMatch, type Team } from '../matches/demoMatchesApi';
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

type SetupStep = 'match' | 'team' | 'anthem' | 'cue' | 'ready' | 'match-mode';

type SetupDraft = {
  match?: DemoMatch;
  supportedTeam?: Team;
  anthemSelection?: AnthemSelection;
  cuePointInput: string;
  cuePointSeconds?: number;
};

type ReadyDraft = Required<Pick<SetupDraft, 'match' | 'supportedTeam' | 'anthemSelection' | 'cuePointSeconds'>> & {
  cuePointInput: string;
};

const setupSteps: Array<{ key: Exclude<SetupStep, 'match-mode'>; label: string }> = [
  { key: 'match', label: 'Match' },
  { key: 'team', label: 'Team' },
  { key: 'anthem', label: 'Anthem' },
  { key: 'cue', label: 'Cue point' },
  { key: 'ready', label: 'Ready' },
];

export function MatchSetupFlow() {
  const [step, setStep] = useState<SetupStep>('match');
  const [draft, setDraft] = useState<SetupDraft>({ cuePointInput: formatCuePoint(0) });
  const [matchSpeed, setMatchSpeed] = useState<MatchSpeed>('normal');
  const [matchModeExitRequest, setMatchModeExitRequest] = useState(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function navigate(nextStep: SetupStep) {
    if (step === 'match-mode') {
      if (nextStep === 'ready') {
        setMatchModeExitRequest((current) => current + 1);
      }
      return;
    }

    if (nextStep === 'match' || canEnterStep(nextStep, draft)) {
      setStep(nextStep);
    }
  }

  function selectMatch(match: DemoMatch) {
    setDraft({ match, cuePointInput: formatCuePoint(0) });
    setStep('team');
  }

  function selectTeam(supportedTeam: Team) {
    setDraft((current) => ({
      ...current,
      supportedTeam,
    }));
    setStep('anthem');
  }

  function selectLocalFile(selection: AnthemSelection) {
    setDraft((current) => ({
      match: current.match,
      supportedTeam: current.supportedTeam,
      anthemSelection: selection,
      cuePointInput: formatCuePoint(0),
    }));
  }

  function updateLocalSource(source: LocalAudioSourceMetadata) {
    setDraft((current) =>
      current.anthemSelection
        ? {
            ...current,
            anthemSelection: {
              ...current.anthemSelection,
              source,
            },
          }
        : current,
    );
  }

  function saveCuePoint(cuePointSeconds: number) {
    setDraft((current) => ({
      ...current,
      cuePointSeconds,
      cuePointInput: formatCuePoint(cuePointSeconds),
    }));
    setStep('ready');
  }

  const readyDraft = getReadyDraft(draft);

  return (
    <section className="setup-flow" aria-labelledby="setup-flow-title">
      <SetupShellHeader draft={draft} isCompact={step !== 'match'} />

      <div className="setup-board">
        <SetupStepper currentStep={step} draft={draft} onNavigate={navigate} />

        <div className="setup-stage">
          {step === 'match' ? (
            <section aria-labelledby="setup-flow-title">
              <h2 className="visually-hidden" id="setup-flow-title" ref={headingRef} tabIndex={-1}>
                Select a match
              </h2>
              <DemoMatchList onMatchSelect={selectMatch} selectedMatchId={draft.match?.id} />
            </section>
          ) : null}

          {step === 'team' && draft.match ? (
            <TeamSelectionStep draft={draft as SetupDraft & { match: DemoMatch }} headingRef={headingRef} onSelectTeam={selectTeam} />
          ) : null}

          {step === 'anthem' && draft.match && draft.supportedTeam ? (
            <AnthemSelectionStep
              draft={draft as SetupDraft & { match: DemoMatch; supportedTeam: Team }}
              headingRef={headingRef}
              onContinue={() => setStep('cue')}
              onSelectLocalFile={selectLocalFile}
              onUpdateLocalSource={updateLocalSource}
            />
          ) : null}

          {step === 'cue' && draft.match && draft.supportedTeam && draft.anthemSelection ? (
            <CuePointStep
              draft={draft as SetupDraft & { match: DemoMatch; supportedTeam: Team; anthemSelection: AnthemSelection }}
              headingRef={headingRef}
              onCuePointInputChange={(cuePointInput) => setDraft((current) => ({ ...current, cuePointInput }))}
              onReady={saveCuePoint}
            />
          ) : null}

          {step === 'ready' && readyDraft ? (
            <ReadyStep
              draft={readyDraft}
              headingRef={headingRef}
              onStartMatch={(speed) => {
                setMatchSpeed(speed);
                setStep('match-mode');
              }}
            />
          ) : null}

          {step === 'match-mode' && readyDraft ? (
            <MatchModeStep
              draft={readyDraft}
              exitRequest={matchModeExitRequest}
              onEndMatchMode={() => setStep('ready')}
              speed={matchSpeed}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SetupShellHeader({ draft, isCompact }: { draft: SetupDraft; isCompact: boolean }) {
  return (
    <header className={isCompact ? 'flow-hero flow-hero--compact' : 'flow-hero'}>
      <p className="eyebrow">GOALANTHEM</p>
      {isCompact && draft.match ? (
        <>
          <h1>Your goal anthem setup</h1>
          <p className="intro">
            {teamWithFlag(draft.match.homeTeam)} vs {teamWithFlag(draft.match.awayTeam)}
          </p>
        </>
      ) : (
        <>
          <h1>Your team scores. Your anthem plays.</h1>
          <p className="intro">Choose a match, import a local anthem, and sync the app with kickoff on your TV.</p>
        </>
      )}
    </header>
  );
}

function SetupStepper({
  currentStep,
  draft,
  onNavigate,
}: {
  currentStep: SetupStep;
  draft: SetupDraft;
  // eslint-disable-next-line no-unused-vars
  onNavigate: (step: SetupStep) => void;
}) {
  return (
    <nav aria-label="Setup steps" className="setup-stepper">
      <ol>
        {setupSteps.map((stepItem, index) => {
          const state = getStepState(stepItem.key, currentStep, draft);
          const isDisabled = state === 'locked' || (currentStep === 'match-mode' && stepItem.key !== 'ready');
          const label = `${stepItem.label}: ${state === 'locked' ? 'locked' : state}`;

          return (
            <li key={stepItem.key}>
              <button
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={label}
                className="setup-stepper__button"
                data-state={state}
                disabled={isDisabled}
                onClick={() => onNavigate(stepItem.key)}
                type="button"
              >
                <span className="setup-stepper__number">{index + 1}</span>
                <span>{stepItem.label}</span>
                <span className="setup-stepper__state">{stateLabel[state]}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            aria-current={currentStep === 'match-mode' ? 'step' : undefined}
            className="setup-stepper__button"
            data-state={currentStep === 'match-mode' ? 'current' : 'locked'}
            disabled
            type="button"
          >
            <span className="setup-stepper__number">6</span>
            <span>Match mode</span>
            <span className="setup-stepper__state">{currentStep === 'match-mode' ? 'Current' : 'Start only'}</span>
          </button>
        </li>
      </ol>
    </nav>
  );
}

function TeamSelectionStep({
  draft,
  headingRef,
  onSelectTeam,
}: {
  draft: SetupDraft & { match: DemoMatch };
  headingRef: RefObject<HTMLHeadingElement | null>;
  // eslint-disable-next-line no-unused-vars
  onSelectTeam: (supportedTeam: Team) => void;
}) {
  return (
    <section className="setup-card" aria-labelledby="team-selection-title">
      <div className="step-heading">
        <p className="step-label">Supported team</p>
        <h2 id="team-selection-title" ref={headingRef} tabIndex={-1}>
          Choose the team whose goals trigger your anthem.
        </h2>
        <p className="match-versus">
          {teamWithFlag(draft.match.homeTeam)} <span>vs</span> {teamWithFlag(draft.match.awayTeam)}
        </p>
      </div>

      <div className="team-grid" role="group" aria-labelledby="team-selection-title">
        {[draft.match.homeTeam, draft.match.awayTeam].map((team) => {
          const isSelected = draft.supportedTeam?.id === team.id;

          return (
            <button
              key={team.id}
              aria-pressed={isSelected}
              className="team-card"
              data-selected={isSelected}
              onClick={() => onSelectTeam(team)}
              type="button"
            >
              <CountryFlag countryCode={team.countryCode} countryName={team.name} decorative size="large" />
              <span className="team-card__label">{team.name}</span>
              <span className="team-card__status">{isSelected ? 'Selected' : `Support ${team.name}`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnthemSelectionStep({
  draft,
  headingRef,
  onContinue,
  onSelectLocalFile,
  onUpdateLocalSource,
}: {
  draft: SetupDraft & { match: DemoMatch; supportedTeam: Team };
  headingRef: RefObject<HTMLHeadingElement | null>;
  onContinue: () => void;
  // eslint-disable-next-line no-unused-vars
  onSelectLocalFile: (anthemSelection: AnthemSelection) => void;
  // eslint-disable-next-line no-unused-vars
  onUpdateLocalSource: (source: LocalAudioSourceMetadata) => void;
}) {
  const localSelection = draft.anthemSelection;
  const localSource = localSelection?.source ?? { sourceType: 'local' as const };
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const sourceUrlValidation =
    localSource.sourceType === 'pixabay' && localSource.sourceUrl ? validatePixabayMusicUrl(localSource.sourceUrl) : null;

  function handleFile(file: File | undefined) {
    const validationError = validateLocalAudioFile(file);
    setFileError(validationError);

    if (file && validationError === null) {
      onSelectLocalFile({ kind: 'local', file, source: { sourceType: 'local' } });
    }
  }

  return (
    <section className="setup-card" aria-labelledby="anthem-selection-title">
      <div className="step-heading">
        <p className="step-label">Local anthem</p>
        <h2 id="anthem-selection-title" ref={headingRef} tabIndex={-1}>
          Choose your goal anthem
        </h2>
        <p>Select an MP3, WAV, M4A, or another browser-supported audio file. The file stays on this device.</p>
      </div>

      <div
        className="upload-card"
        data-drag-active={isDragActive}
        data-selected={Boolean(localSelection)}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <div>
          <p className="upload-card__title">Drop your audio here, or browse</p>
          <p className="upload-card__note">Up to 50 MB. Stored only in this browser session.</p>
        </div>
        <label className="file-picker">
          <span>Choose a local audio file</span>
          <input accept="audio/*" aria-label="Choose a local audio file" onChange={(event) => handleFile(event.currentTarget.files?.[0])} type="file" />
        </label>
      </div>

      {fileError ? (
        <p className="field-error" role="alert">
          {fileError}
        </p>
      ) : null}

      {localSelection ? (
        <div className="selected-file-card">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{localSelection.file.name}</strong>
            <p>
              {formatFileSize(localSelection.file.size)} · {getSourceTypeLabel(localSource.sourceType)}
            </p>
          </div>
          <button className="primary-action" onClick={onContinue} type="button">
            Continue to cue point
          </button>
        </div>
      ) : (
        <button className="primary-action" disabled type="button">
          Continue to cue point
        </button>
      )}

      <PixabayMusicGuide />

      {localSelection ? (
        <div className="source-metadata">
          <fieldset className="source-type-options">
            <legend>Source</legend>
            <label>
              <input checked={localSource.sourceType === 'local'} name="local-audio-source-type" onChange={() => onUpdateLocalSource({ sourceType: 'local' })} type="radio" />
              My local file
            </label>
            <label>
              <input
                checked={localSource.sourceType === 'pixabay'}
                name="local-audio-source-type"
                onChange={() => onUpdateLocalSource({ ...localSource, sourceType: 'pixabay' })}
                type="radio"
              />
              Downloaded from Pixabay
            </label>
          </fieldset>

          {localSource.sourceType === 'pixabay' ? (
            <details className="metadata-fields">
              <summary>Source details and license notes</summary>
              <p className="subtle-text">Optional notes for your own source record. They are not sent to the backend.</p>
              <label>
                <span>Track title</span>
                <input onChange={(event) => onUpdateLocalSource(cleanSourceMetadata({ ...localSource, title: event.currentTarget.value }))} type="text" value={localSource.title ?? ''} />
              </label>
              <label>
                <span>Creator or contributor</span>
                <input onChange={(event) => onUpdateLocalSource(cleanSourceMetadata({ ...localSource, creator: event.currentTarget.value }))} type="text" value={localSource.creator ?? ''} />
              </label>
              <label>
                <span>Original Pixabay music-page URL</span>
                <input
                  aria-describedby="pixabay-source-url-message"
                  onChange={(event) => onUpdateLocalSource(cleanSourceMetadata({ ...localSource, sourceUrl: event.currentTarget.value }))}
                  type="url"
                  value={localSource.sourceUrl ?? ''}
                />
              </label>
              {sourceUrlValidation && !sourceUrlValidation.isValid ? (
                <p className="field-error" id="pixabay-source-url-message" role="alert">
                  {sourceUrlValidation.message} You can still continue.
                </p>
              ) : (
                <p className="subtle-text" id="pixabay-source-url-message">
                  Use the original Pixabay music page when you have it.
                </p>
              )}
              <label>
                <span>Download date</span>
                <input onChange={(event) => onUpdateLocalSource(cleanSourceMetadata({ ...localSource, downloadedOn: event.currentTarget.value }))} type="date" value={localSource.downloadedOn ?? ''} />
              </label>
              <label>
                <span>License, certificate, or Content ID note</span>
                <textarea onChange={(event) => onUpdateLocalSource(cleanSourceMetadata({ ...localSource, licenseNote: event.currentTarget.value }))} rows={3} value={localSource.licenseNote ?? ''} />
              </label>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CuePointStep({
  draft,
  headingRef,
  onCuePointInputChange,
  onReady,
}: {
  draft: SetupDraft & { match: DemoMatch; supportedTeam: Team; anthemSelection: AnthemSelection };
  headingRef: RefObject<HTMLHeadingElement | null>;
  // eslint-disable-next-line no-unused-vars
  onCuePointInputChange: (cuePointInput: string) => void;
  // eslint-disable-next-line no-unused-vars
  onReady: (cuePointSeconds: number) => void;
}) {
  const { audioRef, durationSeconds, handleLoadedMetadata, playFromCue, preview, stopPreview } = useAnthemPreview(draft.anthemSelection);
  const cuePointValidation = parseCuePointInput(draft.cuePointInput, durationSeconds ?? null);
  const cuePointError = cuePointValidation.error;
  const cuePointSeconds = cuePointValidation.cuePointSeconds;
  const sliderMax = durationSeconds ?? 0;

  useEffect(() => () => stopPreview(), [stopPreview]);

  return (
    <section className="setup-card" aria-labelledby="cue-point-title">
      <div className="step-heading">
        <p className="step-label">Cue point</p>
        <h2 id="cue-point-title" ref={headingRef} tabIndex={-1}>
          Choose where the anthem should start after a goal.
        </h2>
        <p>Play the track, pause at the best moment, then save that position.</p>
      </div>

      <div className="cue-editor">
        <div className="cue-editor__preview">
          <strong>{preview?.label ?? draft.anthemSelection.file.name}</strong>
          <audio aria-label="Preview selected anthem" controls onLoadedMetadata={handleLoadedMetadata} preload="metadata" ref={audioRef} src={preview?.audioUrl ?? undefined} />
          <p>
            Current cue: <strong>Anthem starts at {cuePointSeconds !== null ? formatCuePoint(cuePointSeconds) : draft.cuePointInput}</strong>
          </p>
          <p className="subtle-text">{durationSeconds !== null ? `Track duration: ${formatCuePoint(durationSeconds)}` : 'Duration loads after the file is ready.'}</p>
        </div>

        <div className="cue-editor__controls">
          {durationSeconds !== null ? (
            <label className="cue-range">
              <span>Cue position</span>
              <input
                aria-label="Cue position"
                max={sliderMax}
                min={0}
                onChange={(event) => onCuePointInputChange(formatCuePoint(Number(event.currentTarget.value)))}
                type="range"
                value={Math.min(cuePointSeconds ?? 0, sliderMax)}
              />
            </label>
          ) : null}

          <label className="cue-input">
            <span>Exact time in mm:ss</span>
            <input
              aria-describedby={cuePointError ? 'cue-point-error' : 'cue-point-help'}
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => onCuePointInputChange(event.currentTarget.value)}
              placeholder="00:00"
              type="text"
              value={draft.cuePointInput}
            />
          </label>
          {cuePointError ? (
            <p className="field-error" id="cue-point-error" role="alert">
              {cuePointError}
            </p>
          ) : (
            <p className="subtle-text" id="cue-point-help">
              Use mm:ss or the slider after the duration loads.
            </p>
          )}
          <div className="action-row">
            <button className="secondary-action" disabled={preview === null} onClick={() => onCuePointInputChange(formatCuePoint(Math.max(0, Math.floor(audioRef.current?.currentTime ?? 0))))} type="button">
              Use current position
            </button>
            <button
              className="secondary-action"
              disabled={cuePointSeconds === null || cuePointError !== undefined || preview === null}
              onClick={() => {
                if (cuePointSeconds !== null) {
                  void playFromCue(cuePointSeconds);
                }
              }}
              type="button"
            >
              Preview from {cuePointSeconds !== null ? formatCuePoint(cuePointSeconds) : 'cue'}
            </button>
            <button
              className="primary-action"
              disabled={cuePointSeconds === null || cuePointError !== undefined}
              onClick={() => {
                if (cuePointSeconds !== null) {
                  onReady(cuePointSeconds);
                }
              }}
              type="button"
            >
              Save cue point
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadyStep({
  draft,
  headingRef,
  onStartMatch,
}: {
  draft: ReadyDraft;
  headingRef: RefObject<HTMLHeadingElement | null>;
  // eslint-disable-next-line no-unused-vars
  onStartMatch: (speed: MatchSpeed) => void;
}) {
  const [useDemoSpeed, setUseDemoSpeed] = useState(false);
  const anthemSourceSummary = getAnthemSourceSummary(draft.anthemSelection);

  return (
    <section className="setup-card setup-card--ready" aria-labelledby="ready-title">
      <div className="step-heading">
        <p className="step-label">Ready</p>
        <h2 id="ready-title" ref={headingRef} tabIndex={-1}>
          Ready for kickoff
        </h2>
      </div>

      <div className="ready-match-card">
        <div className="ready-team">
          <CountryFlag countryCode={draft.match.homeTeam.countryCode} countryName={draft.match.homeTeam.name} decorative size="medium" />
          <strong>{draft.match.homeTeam.name}</strong>
        </div>
        <span className="ready-vs">vs</span>
        <div className="ready-team">
          <CountryFlag countryCode={draft.match.awayTeam.countryCode} countryName={draft.match.awayTeam.name} decorative size="medium" />
          <strong>{draft.match.awayTeam.name}</strong>
        </div>
        <time dateTime={draft.match.kickoffTime}>{formatMatchDateTime(draft.match.kickoffTime)}</time>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="status-chip">Your team</span>
          <p>{teamWithFlag(draft.supportedTeam)}</p>
        </div>
        <div className="summary-card">
          <span className="status-chip">Anthem</span>
          <p>{draft.anthemSelection.file.name}</p>
          {anthemSourceSummary}
          <p>Cue point: {formatCuePoint(draft.cuePointSeconds)}</p>
        </div>
      </div>

      <div className="sync-card">
        <div>
          <p className="step-label">Sync with your TV</p>
          <h3>Press start when kickoff visibly happens.</h3>
          <p>Do not use the scheduled time. Wait until the referee starts the match on your TV or stream, then press the button below.</p>
        </div>
        <ol>
          <li>Keep this screen ready.</li>
          <li>Watch for kickoff on TV.</li>
          <li>Press start when the ball is kicked.</li>
        </ol>
        <details className="testing-options">
          <summary>Testing</summary>
          <label>
            <input checked={useDemoSpeed} onChange={(event) => setUseDemoSpeed(event.currentTarget.checked)} type="checkbox" />
            Use 15x demo speed
          </label>
        </details>
        <button className="primary-action primary-action--large" onClick={() => onStartMatch(useDemoSpeed ? 'demo' : 'normal')} type="button">
          Start when kickoff happens on TV
        </button>
      </div>
    </section>
  );
}

function MatchModeStep({ draft, exitRequest, onEndMatchMode, speed }: { draft: ReadyDraft; exitRequest: number; onEndMatchMode: () => void; speed: MatchSpeed }) {
  const [mode, setMode] = useState<'remote' | 'local'>('remote');
  const [retryKey, setRetryKey] = useState(0);

  if (mode === 'local') {
    return <LocalMatchModeStep draft={draft} exitRequest={exitRequest} onEndMatchMode={onEndMatchMode} speed={speed} />;
  }

  return (
    <RemoteMatchModeStep
      key={retryKey}
      draft={draft}
      exitRequest={exitRequest}
      onBack={onEndMatchMode}
      onEndMatchMode={onEndMatchMode}
      onRetry={() => setRetryKey((current) => current + 1)}
      onUseLocalFallback={() => setMode('local')}
      speed={speed}
    />
  );
}

function RemoteMatchModeStep({
  draft,
  exitRequest,
  onBack,
  onEndMatchMode,
  onRetry,
  onUseLocalFallback,
  speed,
}: {
  draft: ReadyDraft;
  exitRequest: number;
  onBack: () => void;
  onEndMatchMode: () => void;
  onRetry: () => void;
  onUseLocalFallback: () => void;
  speed: MatchSpeed;
}) {
  const { match, supportedTeam, anthemSelection, cuePointSeconds } = draft;
  const { audioRef, playFromCue, preview, stopPreview } = useAnthemPreview(anthemSelection);
  const [lastAnthemStatus, setLastAnthemStatus] = useState(`Waiting for a ${supportedTeam.name} goal.`);
  const onNewSupportedTeamGoal = useCallback(
    (event: MatchSessionEvent) => {
      setLastAnthemStatus('Playing anthem');
      void playFromCue(cuePointSeconds);
      void event;
    },
    [cuePointSeconds, playFromCue],
  );
  const { endSession, error, snapshot, status } = useRemoteMatchSession({ match, onNewSupportedTeamGoal, speed, supportedTeamId: supportedTeam.id });

  const endAndReturn = useCallback(() => {
    void endSession().finally(() => {
      stopPreview();
      onEndMatchMode();
    });
  }, [endSession, onEndMatchMode, stopPreview]);

  useEffect(() => {
    if (exitRequest > 0) {
      endAndReturn();
    }
  }, [endAndReturn, exitRequest]);

  if (status === 'unavailable') {
    return (
      <section className="match-mode" aria-labelledby="match-mode-title">
        <div className="step-heading">
          <p className="step-label">Remote match mode</p>
          <h2 id="match-mode-title">Remote match mode is unavailable</h2>
          <p>{error ?? 'The backend match session could not be started.'}</p>
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
      anthemSelection={anthemSelection}
      audioRef={audioRef}
      connectionStatus={status}
      lastAnthemStatus={lastAnthemStatus}
      match={match}
      onEndMatchMode={endAndReturn}
      onManualPlayback={() => {
        setLastAnthemStatus('Manual anthem playback');
        void playFromCue(cuePointSeconds);
      }}
      onStopPlayback={() => {
        stopPreview();
        setLastAnthemStatus('Anthem stopped');
      }}
      previewUrl={preview?.audioUrl}
      snapshot={snapshot}
      speed={speed}
      supportedTeam={supportedTeam}
    />
  );
}

function LocalMatchModeStep({ draft, exitRequest, onEndMatchMode, speed }: { draft: ReadyDraft; exitRequest: number; onEndMatchMode: () => void; speed: MatchSpeed }) {
  const { match, supportedTeam, anthemSelection, cuePointSeconds } = draft;
  const { audioRef, playFromCue, preview, stopPreview } = useAnthemPreview(anthemSelection);
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() => createInitialMatchSnapshot());
  const [lastAnthemStatus, setLastAnthemStatus] = useState(`Waiting for a ${supportedTeam.name} goal.`);
  const engineRef = useRef<MatchSimulationEngine | null>(null);

  useEffect(() => {
    const engine = new MatchSimulationEngine({
      events: getDemoMatchEvents(match),
      match,
      scheduler: createBrowserScheduler(),
      speed,
      supportedTeamId: supportedTeam.id,
      onGoalForSupportedTeam: () => {
        setLastAnthemStatus('Playing anthem');
        void playFromCue(cuePointSeconds);
      },
      onSnapshot: setSnapshot,
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
      stopPreview();
    };
  }, [cuePointSeconds, match, playFromCue, speed, stopPreview, supportedTeam.id]);

  const endAndReturn = useCallback(() => {
    engineRef.current?.stop();
    stopPreview();
    onEndMatchMode();
  }, [onEndMatchMode, stopPreview]);

  useEffect(() => {
    if (exitRequest > 0) {
      endAndReturn();
    }
  }, [endAndReturn, exitRequest]);

  return (
    <MatchModeView
      anthemSelection={anthemSelection}
      audioRef={audioRef}
      connectionStatus="local"
      lastAnthemStatus={lastAnthemStatus}
      match={match}
      onEndMatchMode={endAndReturn}
      onManualPlayback={() => {
        setLastAnthemStatus('Manual anthem playback');
        void playFromCue(cuePointSeconds);
      }}
      onStopPlayback={() => {
        stopPreview();
        setLastAnthemStatus('Anthem stopped');
      }}
      previewUrl={preview?.audioUrl}
      snapshot={snapshot}
      speed={speed}
      supportedTeam={supportedTeam}
    />
  );
}

function MatchModeView({
  anthemSelection,
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
  supportedTeam,
}: {
  anthemSelection: AnthemSelection;
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
  supportedTeam: Team;
}) {
  const currentSnapshot = snapshot ?? createInitialMatchSnapshot();

  return (
    <section className="match-mode" aria-labelledby="match-mode-title">
      <div className="match-mode__topbar">
        <div>
          <p className="step-label">Match mode</p>
          <h2 id="match-mode-title">Follow the match</h2>
        </div>
        <button className="secondary-action secondary-action--danger" onClick={onEndMatchMode} type="button">
          End match mode
        </button>
      </div>

      <audio aria-label="Match anthem playback" preload="metadata" ref={audioRef} src={previewUrl} />

      <div className="scoreboard" aria-live="polite">
        <ScoreboardTeam score={currentSnapshot.homeScore} team={match.homeTeam} supportedTeamId={supportedTeam.id} />
        <div className="scoreboard__center">
          <strong>
            {currentSnapshot.homeScore} – {currentSnapshot.awayScore}
          </strong>
          <span>{formatMatchClock(currentSnapshot.elapsedSeconds)}</span>
          <span className="status-chip">{formatMatchStatus(currentSnapshot.status)}</span>
        </div>
        <ScoreboardTeam align="end" score={currentSnapshot.awayScore} team={match.awayTeam} supportedTeamId={supportedTeam.id} />
      </div>

      <div className="match-info-row">
        <span className="status-chip">{formatConnectionStatus(connectionStatus)}</span>
        <span className="status-chip">{speed === 'demo' ? 'Testing · 15x' : 'Normal speed'}</span>
        <span className="status-chip">{describeMatchModeSource(anthemSelection)}</span>
      </div>

      <div className="anthem-status-card">
        <span>{lastAnthemStatus === 'Playing anthem' ? 'Playing anthem' : 'Anthem ready'}</span>
        <strong>{getAnthemStatusMessage(lastAnthemStatus, anthemSelection, supportedTeam)}</strong>
      </div>

      <div className="match-controls">
        <button className="primary-action" onClick={onManualPlayback} type="button">
          Play anthem manually
        </button>
        <button className="secondary-action" onClick={onStopPlayback} type="button">
          Stop anthem
        </button>
      </div>

      <section aria-labelledby="timeline-title" className="timeline-panel">
        <h3 id="timeline-title">Timeline</h3>
        {currentSnapshot.timeline.length > 0 ? (
          <ol>
            {currentSnapshot.timeline.map((event) => (
              <li data-event-type={event.type} key={event.id}>
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

function ScoreboardTeam({ align = 'start', score, supportedTeamId, team }: { align?: 'start' | 'end'; score: number; supportedTeamId: string; team: Team }) {
  const isSupported = team.id === supportedTeamId;

  return (
    <div className="scoreboard__team" data-align={align} data-supported={isSupported}>
      <CountryFlag countryCode={team.countryCode} countryName={team.name} decorative size="large" />
      <span>{team.name}</span>
      <strong>{score}</strong>
      {isSupported ? <em>Your team</em> : null}
    </div>
  );
}

function getAnthemStatusMessage(lastAnthemStatus: string, anthemSelection: AnthemSelection, supportedTeam: Team) {
  if (lastAnthemStatus === 'Playing anthem') {
    return anthemSelection.file.name;
  }

  if (lastAnthemStatus === 'Anthem stopped' || lastAnthemStatus === 'Manual anthem playback') {
    return lastAnthemStatus;
  }

  return `Waiting for a ${supportedTeam.name} goal`;
}

function getStepState(step: Exclude<SetupStep, 'match-mode'>, currentStep: SetupStep, draft: SetupDraft) {
  if (step === currentStep) {
    return 'current';
  }

  if (!canEnterStep(step, draft)) {
    return 'locked';
  }

  const currentIndex = currentStep === 'match-mode' ? setupSteps.length : setupSteps.findIndex((item) => item.key === currentStep);
  const stepIndex = setupSteps.findIndex((item) => item.key === step);
  return stepIndex < currentIndex ? 'completed' : 'available';
}

function canEnterStep(step: SetupStep, draft: SetupDraft) {
  switch (step) {
    case 'match':
      return true;
    case 'team':
      return Boolean(draft.match);
    case 'anthem':
      return Boolean(draft.match && draft.supportedTeam);
    case 'cue':
      return Boolean(draft.match && draft.supportedTeam && draft.anthemSelection);
    case 'ready':
      return Boolean(getReadyDraft(draft));
    case 'match-mode':
      return false;
  }
}

function getReadyDraft(draft: SetupDraft): ReadyDraft | null {
  if (!draft.match || !draft.supportedTeam || !draft.anthemSelection || draft.cuePointSeconds === undefined) {
    return null;
  }

  return {
    match: draft.match,
    supportedTeam: draft.supportedTeam,
    anthemSelection: draft.anthemSelection,
    cuePointInput: draft.cuePointInput,
    cuePointSeconds: draft.cuePointSeconds,
  };
}

const stateLabel = {
  available: 'Available',
  completed: 'Done',
  current: 'Current',
  locked: 'Locked',
} as const;

function getAnthemSourceSummary(selection: AnthemSelection) {
  const source = selection.source ?? { sourceType: 'local' as const };
  const items: ReactNode[] = [<p key="source">Source: {getSourceTypeLabel(source.sourceType)}</p>];

  if (source.sourceType === 'pixabay') {
    if (source.title || source.creator) {
      items.push(
        <p key="creator">
          {[source.title, source.creator].filter(Boolean).join(' · ')}
        </p>,
      );
    }

    const sourceUrl = getSafePixabaySourceUrl(source);
    if (sourceUrl) {
      items.push(
        <p key="source-url">
          <a href={sourceUrl} rel="noreferrer noopener" target="_blank">
            Open Pixabay source <span className="visually-hidden">(opens in a new tab)</span>
          </a>
        </p>,
      );
    }
  }

  return items;
}

function describeMatchModeSource(selection: AnthemSelection) {
  const source = selection.source ?? { sourceType: 'local' as const };
  return `${selection.file.name} · ${getSourceTypeLabel(source.sourceType)}`;
}

function cleanSourceMetadata(source: LocalAudioSourceMetadata): LocalAudioSourceMetadata {
  return {
    sourceType: source.sourceType,
    title: source.title === '' ? undefined : source.title,
    creator: source.creator === '' ? undefined : source.creator,
    sourceUrl: source.sourceUrl?.trim() || undefined,
    downloadedOn: source.downloadedOn || undefined,
    licenseNote: source.licenseNote === '' ? undefined : source.licenseNote,
  };
}

function formatMatchStatus(status: MatchSnapshot['status'] | MatchSessionSnapshot['status']) {
  switch (status) {
    case 'half-time':
      return 'Half-time';
    case 'ended':
      return 'Full-time';
    case 'waiting':
      return 'Waiting';
    default:
      return 'Live';
  }
}

function formatConnectionStatus(status: string) {
  switch (status) {
    case 'connected':
      return '● Connected';
    case 'reconnecting':
      return '● Reconnecting';
    case 'local':
      return '● Local simulation';
    case 'starting':
    case 'connecting':
      return '● Connecting';
    case 'ended':
      return '● Ended';
    default:
      return '● Disconnected';
  }
}

function teamWithFlag(team: Team) {
  return (
    <span className="inline-team">
      <CountryFlag countryCode={team.countryCode} countryName={team.name} decorative />
      <span>{team.name}</span>
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMatchDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
