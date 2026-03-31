/**
 * Placeholder test to verify Jest + ts-jest setup works correctly.
 */
describe('Test setup', () => {
  it('should run tests with TypeScript support', () => {
    const value: string = 'hello';
    expect(value).toBe('hello');
  });

  it('should support async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
