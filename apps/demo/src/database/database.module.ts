import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { models } from './models/index.js'
import { DatabaseSeeder } from './seeder.js'

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'sqlite',
      storage: process.env.DB_STORAGE ?? 'database/database.sqlite',
      models,
      // Create the tables on boot (fine for a demo; use migrations in production).
      autoLoadModels: true,
      synchronize: true,
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    }),
  ],
  providers: [DatabaseSeeder],
})
export class DatabaseModule {}
