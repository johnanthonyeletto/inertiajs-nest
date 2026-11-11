export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

/** e.g. `14:03:27` */
export const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false })
