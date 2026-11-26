import { createContext } from 'react'

/** True while the player is paused or held; slides freeze their JS-driven motion with it. */
export const StoryPaused = createContext(false)

/** Call with true while the viewer explores something on a slide (scrolling the calendar), false when they stop. */
export const StoryHold = createContext(() => {})
