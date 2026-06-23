import { useState } from 'react';
import { DemoMatchList } from '../matches/DemoMatchList';
import { DemoMatch, Team } from '../matches/demoMatchesApi';

type SetupState =
  | { step: 'match'; selectedMatchId?: DemoMatch['id'] }
  | { step: 'team'; match: DemoMatch; supportedTeamId?: Team['id'] };

const setupSteps = ['Match', 'Team', 'Anthem', 'Cue point', 'Ready'] as const;

export function MatchSetupFlow() {
  const [state, setState] = useState<SetupState>({ step: 'match' });

  const selectedTeam =
    state.step === 'team'
      ? [state.match.homeTeam, state.match.awayTeam].find((team) => team.id === state.supportedTeamId)
      : undefined;

  return (
    <section className="setup-flow" aria-labelledby="setup-flow-title">
      <div className="section-heading">
        <p className="step-label">Setup flow</p>
        <h2 id="setup-flow-title">Prepare your match setup</h2>
      </div>

      <ProgressIndicator currentStep={state.step} hasSelectedTeam={selectedTeam !== undefined} />

      {state.step === 'match' ? (
        <DemoMatchList
          onMatchSelect={(match) => setState({ step: 'team', match })}
          selectedMatchId={state.selectedMatchId}
        />
      ) : (
        <section className="team-section" aria-labelledby="team-selection-title">
          <div className="team-section__header">
            <div className="team-section__copy">
              <p className="step-label">Choose team</p>
              <h3 id="team-selection-title">Which team do you support in this match?</h3>
              <p className="team-section__match">
                {state.match.homeTeam.name} vs {state.match.awayTeam.name}
              </p>
            </div>
            <button
              className="secondary-action"
              onClick={() => setState({ step: 'match', selectedMatchId: state.match.id })}
              type="button"
            >
              Back to matches
            </button>
          </div>

          <div className="team-grid" role="group" aria-labelledby="team-selection-title">
            {[state.match.homeTeam, state.match.awayTeam].map((team) => {
              const isSelected = state.supportedTeamId === team.id;

              return (
                <button
                  key={team.id}
                  className="team-card"
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => setState({ ...state, supportedTeamId: team.id })}
                  type="button"
                >
                  <span className="team-card__label">{team.name}</span>
                  <span className="team-card__status">{isSelected ? 'Selected team' : 'Select this team'}</span>
                </button>
              );
            })}
          </div>

          <p className="team-selection-summary" aria-live="polite">
            {selectedTeam
              ? `${selectedTeam.name} is set as your supported team. Anthem selection is the next planned step.`
              : 'Select one of the two teams to continue the setup later when anthem selection is added.'}
          </p>
        </section>
      )}
    </section>
  );
}

type ProgressIndicatorProps = {
  currentStep: SetupState['step'];
  hasSelectedTeam: boolean;
};

function ProgressIndicator({ currentStep, hasSelectedTeam }: ProgressIndicatorProps) {
  return (
    <ol className="progress-indicator" aria-label="Setup progress">
      {setupSteps.map((step, index) => {
        const status = getProgressStatus(index, currentStep, hasSelectedTeam);

        return (
          <li className="progress-step" data-status={status} key={step}>
            <span className="progress-step__index">{index + 1}</span>
            <span className="progress-step__name">{step}</span>
            <span className="progress-step__state">{progressStatusLabel[status]}</span>
          </li>
        );
      })}
    </ol>
  );
}

const progressStatusLabel = {
  completed: 'Done',
  current: 'Current',
  next: 'Next',
  upcoming: 'Planned',
} as const;

function getProgressStatus(stepIndex: number, currentStep: SetupState['step'], hasSelectedTeam: boolean) {
  if (stepIndex === 0) {
    return currentStep === 'match' ? 'current' : 'completed';
  }

  if (stepIndex === 1) {
    if (currentStep === 'match') {
      return 'upcoming';
    }

    return hasSelectedTeam ? 'completed' : 'current';
  }

  if (stepIndex === 2 && currentStep === 'team' && hasSelectedTeam) {
    return 'next';
  }

  return 'upcoming';
}
