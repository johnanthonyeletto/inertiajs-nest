import type { NonAttribute } from 'sequelize'
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript'
import { Contact } from './contact.model.js'
import { User } from './user.model.js'

@Table({ tableName: 'notes' })
export class Note extends Model {
  @ForeignKey(() => Contact)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare contactId: number

  @BelongsTo(() => Contact)
  declare contact?: NonAttribute<Contact>

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number

  @BelongsTo(() => User)
  declare user?: NonAttribute<User>

  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string
}
