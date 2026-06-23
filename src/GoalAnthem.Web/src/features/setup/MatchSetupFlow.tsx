import { useState } from 'react';
import { demoAnthems } from '../anthems/demoAnthems';
import { DemoMatchList } from '../matches/DemoMatchList';
import { type DemoMatch, type Team } from '../matches/demoMatchesApi';
import { parseCuePointInput, formatCuePoint } from './cuePoint';
import { type AnthemSelection, useAnthemPreview } from './anthemPreview';

type SetupDraft = {
  match: DemoMatch;
  supportedTeam?: Team;
  anthemSelection?: AnthemSelection;
  cuePointInput: string;
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
    };

const setupSteps = ['Match', 'Team', 'Anthem', 'Cue point', 'Ready'] as const;

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
          onBackToCuePoint={() =>
            setState({
              step: 'cue',
              draft: {
                match: state.draft.match,
                supportedTeam: state.draft.supportedTeam,
                anthemSelection: state.draft.anthemSelection,
                cuePointInput: formatCuePoint(state.draft.cuePointSeconds),
              },
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
};

function AnthemSelectionStep({ draft, onBackToTeam, onSelectAnthem }: AnthemSelectionStepProps) {
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
  draft: SetupDraft & { supportedTeam: Team; anthemSelection: AnthemSelection; cuePointSeconds: number };
  onBackToCuePoint: () => void;
};

function ReadyStep({ draft, onBackToCuePoint }: ReadyStepProps) {
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
          <dt>Cue point</dt>
          <dd>{formatCuePoint(draft.cuePointSeconds)}</dd>
        </div>
      </dl>
    </section>
  );
}

function describeAnthemSelection(selection: AnthemSelection) {
  return selection.kind === 'demo' ? selection.anthem.name : `Local file: ${selection.file.name}`;
}
