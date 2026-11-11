import { mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { Sequelize } from 'sequelize-typescript'
import { models } from './models/index.js'
import { DEMO_USER, seed } from './seeder.js'

const command = process.argv[2]

if (command !== 'fresh') {
  console.error('Usage: node dist/database/cli.js fresh')
  process.exit(1)
}

const storage = process.env.DB_STORAGE ?? 'database/database.sqlite'

rmSync(storage, { force: true })
mkdirSync(dirname(storage), { recursive: true })

const sequelize = new Sequelize({ dialect: 'sqlite', storage, models, logging: false })

await sequelize.sync()
await seed()
await sequelize.close()

console.log(`Database refreshed. Sign in with ${DEMO_USER.email} / ${DEMO_USER.password}`)
