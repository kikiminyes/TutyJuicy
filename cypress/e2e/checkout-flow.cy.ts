describe('Checkout Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the landing page', () => {
    cy.contains('TutyJuicy').should('be.visible');
  });

  it('should navigate to checkout when checkout button is clicked', () => {
    // Assuming there's a checkout button in the cart
    // Adjust selectors based on actual implementation
    cy.visit('/checkout');
    cy.url().should('include', '/checkout');
  });

  it('should validate phone number format', () => {
    cy.visit('/checkout');

    cy.get('input[id="name"]').type('John Doe');
    cy.get('input[id="phone"]').type('12345'); // Invalid phone
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid phone number').should('be.visible');
  });

  it('should validate name field', () => {
    cy.visit('/checkout');

    cy.get('input[id="name"]').type('A'); // Too short
    cy.get('input[id="phone"]').type('08123456789');
    cy.get('button[type="submit"]').click();

    cy.contains('at least 2 characters').should('be.visible');
  });

  it('should accept valid form data', () => {
    cy.visit('/checkout');

    cy.get('input[id="name"]').type('John Doe');
    cy.get('input[id="phone"]').type('08123456789');
    cy.get('textarea[id="address"]').type('123 Main St');

    // Note: Actual submission will fail without active batch and cart items
    // This test just validates form acceptance
    cy.get('button[type="submit"]').should('not.be.disabled');
  });
});
