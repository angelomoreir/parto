/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Symptom {
  id: string;
  date: string;
  type: string;
  intensity: 'ligeira' | 'moderada' | 'intensa';
  notes?: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  doctor?: string;
  notes?: string;
}

export interface KickCount {
  id: string;
  date: string;
  count: number;
  durationMinutes: number;
}

export interface Contraction {
  id: string;
  startTime: string;
  duration: number; // in seconds
  frequency: number; // seconds since last contraction
}

export interface DiaryEntry {
  id: string;
  date: string;
  week: number;
  note: string;
  imageUrl?: string;
}

export interface BloodPressureEntry {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
}

export interface BirthPlan {
  companion: string;
  painRelief: string[];
  environment: string[];
  postBirth: string[];
  notes: string;
}

export interface ChecklistItem {
  id: string;
  category: 'mãe' | 'bebé' | 'acompanhante';
  task: string;
  completed: boolean;
}

export interface VitaminLog {
  id: string;
  date: string;
  name: string;
  time: string;
  taken: boolean;
}

export interface ExamEntry {
  id: string;
  date: string;
  title: string;
  category: 'Análises' | 'Ecografia' | 'Rastreio' | 'Outro';
  result?: string;
  notes?: string;
}

export interface HydrationEntry {
  date: string;
  amountMl: number;
}

export interface BabyName {
  id: string;
  name: string;
  gender: 'menino' | 'menina' | 'unissexo';
  votes: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface BellyPhoto {
  id: string;
  date: string;
  week: number;
  imageUrl: string;
}

export interface ReflectionEntry {
  id: string;
  date: string;
  week: number;
  type: 'carta' | 'sonho' | 'reflexao';
  title: string;
  content: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  price: number;
  bought: boolean;
  priority: 'baixa' | 'média' | 'alta';
  notes?: string;
  checklistId?: string;
}

export interface PregnancyState {
  dueDate: string;
  conceptionDate?: string;
  lastPeriodDate?: string;
}

export interface WeekData {
  week: number;
  fruit: string;
  size: string;
  weight: string;
  description: string;
  tips: string[];
}
