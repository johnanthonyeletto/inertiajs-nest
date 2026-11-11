import type { NonAttribute } from 'sequelize'
import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript'
import { Note } from './note.model.js'
import { Organization } from './organization.model.js'

@Table({ tableName: 'contacts', paranoid: true })
export class Contact extends Model {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number | null

  @BelongsTo(() => Organization)
  declare organization?: NonAttribute<Organization | null>

  @Column({ type: DataType.STRING, allowNull: false })
  declare firstName: string

  @Column({ type: DataType.STRING, allowNull: false })
  declare lastName: string

  @Column(DataType.STRING)
  declare email: string | null

  @Column(DataType.STRING)
  declare phone: string | null

  @Column(DataType.STRING)
  declare address: string | null

  @Column(DataType.STRING)
  declare city: string | null

  @Column(DataType.STRING)
  declare region: string | null

  @Column(DataType.STRING(2))
  declare country: string | null

  @Column(DataType.STRING)
  declare postalCode: string | null

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isFavorite: boolean

  @Column(DataType.STRING)
  declare avatarPath: string | null

  @HasMany(() => Note)
  declare notes?: NonAttribute<Note[]>

  get name(): string {
    return `${this.firstName} ${this.lastName}`
  }
}
