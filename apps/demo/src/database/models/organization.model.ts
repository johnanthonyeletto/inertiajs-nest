import type { NonAttribute } from 'sequelize'
import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'
import { Contact } from './contact.model.js'

@Table({ tableName: 'organizations', paranoid: true })
export class Organization extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string

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

  @HasMany(() => Contact)
  declare contacts?: NonAttribute<Contact[]>
}
