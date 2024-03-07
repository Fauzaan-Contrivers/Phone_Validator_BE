// src/entities/your-entity.entity.ts

import { Sheets } from 'src/sheets/sheets.entity';
import { UserSheets } from 'src/userSheets/userSheets.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity("users")
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  password: string;


  @Column()
  role: string;

  @OneToMany(() => Sheets, sheet => sheet.user)
  sheets: Sheets[];

  @OneToMany(() => UserSheets, sheet => sheet.user)
  userSheets: UserSheets[];
}
