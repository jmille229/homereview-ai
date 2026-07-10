import { defineCliConfig } from 'sanity/cli'
import { projectId, dataset } from './sanity/env'

export default defineCliConfig({
  api: { projectId, dataset },
  // Deploy target hostname → <studioHost>.sanity.studio. Setting it here avoids
  // the interactive prompt (which can crash in some terminals). If this exact
  // name is already taken globally, change it to something unique.
  studioHost: 'homereview-ai',
})
