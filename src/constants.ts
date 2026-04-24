/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeekData } from './types';

export const WEEKS_DATA: Record<number, WeekData> = {
  4: {
    week: 4,
    fruit: 'Semente de Papoila',
    size: '2 mm',
    weight: '< 1 g',
    description: 'O embrião implantou-se no útero. As células começam a especializar-se.',
    tips: ['Beba muita água', 'Comece a tomar ácido fólico', 'Evite álcool e tabaco']
  },
  8: {
    week: 8,
    fruit: 'Framboesa',
    size: '1.6 cm',
    weight: '1 g',
    description: 'Os braços e pernas estão a crescer. O coração bate rítmico.',
    tips: ['Agende a primeira ecografia', 'Pode sentir náuseas matinais', 'Descanse sempre que possível']
  },
  12: {
    week: 12,
    fruit: 'Lima',
    size: '5.4 cm',
    weight: '14 g',
    description: 'O risco de aborto diminui drasticamente. O bebé já se mexe, embora ainda não o sinta.',
    tips: ['Partilhe a notícia com a família', 'Cuidado com a exposição solar', 'Mantenha uma dieta equilibrada']
  },
  16: {
    week: 16,
    fruit: 'Abacate',
    size: '11.6 cm',
    weight: '100 g',
    description: 'O bebé pode começar a ouvir a sua voz. Os reflexos estão a desenvolver-se.',
    tips: ['Fale com o seu bebé', 'Hidrate bem a pele da barriga', 'Faça caminhadas leves']
  },
  20: {
    week: 20,
    fruit: 'Banana',
    size: '25.6 cm',
    weight: '300 g',
    description: 'Está a meio da jornada! O bebé já tem impressões digitais.',
    tips: ['Ecografia morfológica', 'Verifique a sua postura', 'Planeie o quarto do bebé']
  },
  24: {
    week: 24,
    fruit: 'Pimento',
    size: '30 cm',
    weight: '600 g',
    description: 'Os pulmões estão a formar-se. O bebé reage a sons e luz.',
    tips: ['Teste da glicose', 'Mantenha as pernas elevadas', 'Evite estar muito tempo de pé']
  },
  28: {
    week: 28,
    fruit: 'Beringela',
    size: '37.6 cm',
    weight: '1 kg',
    description: 'Início do terceiro trimestre. O bebé abre e fecha os olhos.',
    tips: ['Prepare a mala da maternidade', 'Conte os movimentos do bebé', 'Informe-se sobre o parto']
  },
  32: {
    week: 32,
    fruit: 'Cabaça',
    size: '42.4 cm',
    weight: '1.7 kg',
    description: 'O bebé pratica a respiração. O espaço começa a ficar apertado.',
    tips: ['Massagem perineal', 'Lave as roupinhas do bebé', 'Finalize o plano de parto']
  },
  36: {
    week: 36,
    fruit: 'Papaia',
    size: '47.4 cm',
    weight: '2.6 kg',
    description: 'O bebé desce para a bacia. O ganho de peso abranda.',
    tips: ['Consultas semanais', 'Instale a cadeira no carro', 'Descanse o máximo possível']
  },
  40: {
    week: 40,
    fruit: 'Melancia Pequena',
    size: '51.2 cm',
    weight: '3.4 kg',
    description: 'Data prevista do parto! O bebé está pronto para conhecer o mundo.',
    tips: ['Esteja atenta às contrações', 'Mantenha a calma', 'Controle os movimentos fetais']
  }
};

export const FALLBACK_WEEK: WeekData = {
  week: 0,
  fruit: 'Descobrir...',
  size: '---',
  weight: '---',
  description: 'Estamos a preparar o seu guia personalizado.',
  tips: ['Consulte o seu médico', 'Mantenha uma vida saudável']
};
