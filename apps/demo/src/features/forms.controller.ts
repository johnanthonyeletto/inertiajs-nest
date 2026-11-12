import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AnyFilesInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '../auth/auth.js'
import { sleep } from '../common/time.js'
import { serializeContact } from '../crm/serializers.js'
import { Contact } from '../database/models/index.js'
import { Inertia, type InertiaContext, Precognitive, ValidationException } from '@johnanthonyeletto/nestjs-inertia'
import { AccountDto, PrimaryValidationDto, ProfileDto, SecondaryValidationDto, UploadDto } from './dto.js'

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

@Controller('features/forms')
@UseGuards(AuthGuard)
export class FormsController {
  @Get('use-form')
  useForm(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/UseForm')
  }

  @Post('use-form')
  submitUseForm(@Inertia() inertia: InertiaContext, @Body() body: ProfileDto) {
    return inertia
      .flash('toast', { type: 'success', message: `Saved ${body.name} (${body.plan}) at ${body.company.name}.` })
      .back()
  }

  @Get('form-component')
  formComponent(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/FormComponent')
  }

  @Post('form-component')
  submitFormComponent(@Inertia() inertia: InertiaContext, @Body() body: ProfileDto) {
    return inertia
      .flash('toast', { type: 'success', message: `<Form> submitted for ${body.name}.` })
      .flash('submitted', body)
      .back()
  }

  @Get('file-uploads')
  fileUploads(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/FileUploads')
  }

  @Post('file-uploads')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 50 * 1024 * 1024, files: 10 } }))
  submitFileUploads(
    @Inertia() inertia: InertiaContext,
    @Body() body: UploadDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    if (files.length === 0) {
      throw ValidationException.withMessages({ files: 'Please choose at least one file.' })
    }

    return inertia
      .flash('toast', { type: 'success', message: `"${body.title}": uploaded ${files.length} file(s).` })
      .flash(
        'uploaded',
        files.map((file) => ({ field: file.fieldname, name: file.originalname, size: formatBytes(file.size) })),
      )
      .back()
  }

  @Get('validation')
  validation(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/Validation')
  }

  @Post('validation')
  submitPrimary(@Inertia() inertia: InertiaContext, @Body() _body: PrimaryValidationDto) {
    return inertia.flash('toast', { type: 'success', message: 'Primary form is valid.' }).back()
  }

  @Post('validation/secondary')
  submitSecondary(@Inertia() inertia: InertiaContext, @Body() _body: SecondaryValidationDto) {
    return inertia.flash('toast', { type: 'success', message: 'Secondary form is valid.' }).back()
  }

  @Get('precognition')
  precognition(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/Precognition')
  }

  @Post('precognition')
  @Precognitive()
  createAccount(@Inertia() inertia: InertiaContext, @Body() body: AccountDto) {
    // Only reached by real submissions: Precognition requests end after validation.
    return inertia.flash('toast', { type: 'success', message: `Account "${body.username}" passed validation!` }).back()
  }

  @Get('optimistic-updates')
  async optimisticUpdates(@Inertia() inertia: InertiaContext) {
    const contacts = await Contact.findAll({ order: [['lastName', 'ASC']], limit: 8 })

    return inertia.render('Features/Forms/OptimisticUpdates', { contacts: contacts.map(serializeContact) })
  }

  @Post('optimistic-updates/:id/toggle')
  async toggleFavorite(
    @Inertia() inertia: InertiaContext,
    @Param('id', ParseIntPipe) id: number,
    @Query('fail') fail?: string,
  ) {
    await sleep(1000)

    if (fail) {
      throw ValidationException.withMessages({ favorite: 'Simulated failure: the optimistic update was rolled back.' })
    }

    const contact = await Contact.findByPk(id)

    if (!contact) {
      throw new NotFoundException()
    }

    await contact.update({ isFavorite: !contact.isFavorite })

    return inertia.back()
  }

  @Get('use-http')
  useHttp(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Forms/UseHttp')
  }
}
