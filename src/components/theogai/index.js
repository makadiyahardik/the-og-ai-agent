// TheoGAI Generative UI Components
// These components are dynamically rendered based on AI context

export { default as DecisionCard } from './DecisionCard';
export { default as GoalTree } from './GoalTree';
export { default as InsightCard, InsightsPanel } from './InsightCard';
export { default as RelationshipCard, RelationshipsPanel } from './RelationshipCard';
export { default as HabitTracker } from './HabitTracker';

// Component Registry for Dynamic Rendering
export const componentRegistry = {
  DecisionCard: require('./DecisionCard').default,
  GoalTree: require('./GoalTree').default,
  InsightCard: require('./InsightCard').default,
  InsightsPanel: require('./InsightCard').InsightsPanel,
  RelationshipCard: require('./RelationshipCard').default,
  RelationshipsPanel: require('./RelationshipCard').RelationshipsPanel,
  HabitTracker: require('./HabitTracker').default,
};

// Helper to render dynamic components from AI response
export function renderGenerativeUI(component) {
  if (!component || !component.type) return null;

  const Component = componentRegistry[component.type];
  if (!Component) {
    console.warn(`Unknown component type: ${component.type}`);
    return null;
  }

  return Component;
}
