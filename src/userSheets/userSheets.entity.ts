// src/entities/your-entity.entity.ts

import { Users } from 'src/auth/users.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity("user-sheets")
export class UserSheets {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column()
  cleanedName: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column()
  fileType: string;

  @ManyToOne(() => Users, user => user.id)
  user: Users
}
