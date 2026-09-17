export const SCENE_FEATURES = Object.freeze({
  erinnerungssignal: Object.freeze(['memory-wheel']),
})

export const sceneHasFeature = (sceneId, feature) => SCENE_FEATURES[sceneId]?.includes(feature) === true
