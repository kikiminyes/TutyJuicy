/// <reference types="cypress" />

declare module 'cypress' {
  interface Chainable {
    login(email: string, password: string): Chainable<void>;
  }
}

export {};
