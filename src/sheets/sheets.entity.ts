// src/entities/your-entity.entity.ts

import { Users } from 'src/auth/users.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity("sheets")
export class Sheets {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phone: string;

  @ManyToOne(() => Users, user => user.id)
  user: Users
}
