import '@testing-library/cypress/add-commands';

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/admin');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
});
