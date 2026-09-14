export const DEFAULT_STATE = Object.freeze({
  loggedIn: false,
  view: 'overview',
  fundus: ['moosarchiv'],
  activeStory: 'moosarchiv',
  activeWorld: 'nebelmark',
})

export function readState(storage) {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(storage.getItem('lore-state')) }
  } catch {
    return { ...DEFAULT_STATE, fundus: [...DEFAULT_STATE.fundus] }
  }
}

export function addStoryToFundus(fundus, storyId) {
  return fundus.includes(storyId) ? fundus : [...fundus, storyId]
}
