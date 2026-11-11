import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'

const app = await NestFactory.create<NestExpressApplication>(AppModule)

app.set('trust proxy', 'loopback')
app.useStaticAssets('public', { index: false })
app.useStaticAssets('storage/uploads', { prefix: '/uploads', index: false })
app.enableShutdownHooks()

await app.listen(Number(process.env.PORT ?? 3000))

console.log(`\n  ➜  App running at http://localhost:${process.env.PORT ?? 3000}\n`)
