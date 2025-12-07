describe('Order Tracking', () => {
  beforeEach(() => {
    cy.visit('/track');
  });

  it('should display order tracking page', () => {
    cy.contains('Track Your Orders').should('be.visible');
  });

  it('should have phone number input field', () => {
    cy.get('input[type="tel"]').should('be.visible');
  });

  it('should validate phone number on search', () => {
    cy.get('input[type="tel"]').type('invalid');
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid phone number').should('be.visible');
  });

  it('should accept valid phone number format', () => {
    cy.get('input[type="tel"]').type('08123456789');
    cy.get('button[type="submit"]').click();

    // Should initiate search (results depend on database)
    // At minimum, error message should not be visible
    cy.contains('Invalid phone number').should('not.exist');
  });

  it('should display no results message when no orders found', () => {
    // Using a phone number that likely has no orders
    cy.get('input[type="tel"]').type('08999999999');
    cy.get('button[type="submit"]').click();

    cy.contains('No orders found', { timeout: 10000 }).should('be.visible');
  });
});
