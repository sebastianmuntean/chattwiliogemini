
import { Type } from '@google/genai';

const tools = {
  functionDeclarations: [
    {
      name: 'getAvailableCategories',
      description: 'Obtine o lista cu sectiile medicale disponibile (categorii) la clinica, impreuna cu ID-urile lor. Foloseste aceasta functie prima data pentru a afla ce sectii exista si pentru a obtine ID-ul necesar pentru pasii urmatori.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
      },
    },
    {
      name: 'getAvailableAppointments',
      description: 'Obtine intervalele orare disponibile pentru o anumita sectie (categorie) intr-un interval de date. Foloseste ID-ul categoriei obtinut anterior.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoryId: {
            type: Type.NUMBER,
            description: 'ID-ul numeric al categoriei (sectiei) pentru care se cauta programari.',
          },
          startDate: {
            type: Type.STRING,
            description: 'Data de inceput a intervalului de cautare, in format AAAA-MM-DD. De exemplu, "2024-05-21".',
          },
          endDate: {
            type: Type.STRING,
            description: 'Data de sfarsit a intervalului de cautare, in format AAAA-MM-DD. De obicei, aceeasi cu data de inceput.',
          },
        },
        required: ['categoryId', 'startDate', 'endDate'],
      },
    },
    {
      name: 'bookAppointment',
      description: 'Creeaza programarea finala pentru un pacient dupa ce TOATE detaliile au fost adunate si confirmate: sectie, data, ora, nume, CNP si telefon. Aceasta functie trebuie apelata o singura data, la finalul conversatiei.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoryId: {
            type: Type.NUMBER,
            description: 'ID-ul numeric al categoriei (sectiei) alese.',
          },
          patientName: {
            type: Type.STRING,
            description: "Numele si prenumele complet al pacientului.",
          },
          personalIdentificationNumber: {
            type: Type.STRING,
            description: "Codul Numeric Personal (CNP) al pacientului. Este obligatoriu.",
          },
          phone: {
            type: Type.STRING,
            description: "Numarul de telefon al pacientului.",
          },
          appointmentDate: {
            type: Type.STRING,
            description: 'Data aleasa pentru programare, in format AAAA-MM-DD.',
          },
          startTime: {
            type: Type.STRING,
            description: 'Ora de incepere a programarii aleasa de pacient, exact cum a fost returnata de API (ex: "09:00").',
          },
        },
        required: ['categoryId', 'patientName', 'personalIdentificationNumber', 'phone', 'appointmentDate', 'startTime'],
      },
    },
  ],
};

export { tools };
