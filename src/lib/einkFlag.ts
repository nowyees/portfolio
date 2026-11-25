// /lab?eink: the rigs keep their last frame readable so the e-ink panel can copy it (see eink.ts)
export const EINK_TRIAL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('eink');
