import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClarificationPanel from './ClarificationPanel';

describe('ClarificationPanel', () => {
  const defaultProps = {
    fields: ['categories', 'timeframe'],
    categories: ['Groceries', 'Dining Out', 'Transport'],
    round: 0,
    onRespond: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clarification prompt (round < 2)', () => {
    it('renders a clarification prompt message', () => {
      render(<ClarificationPanel {...defaultProps} />);
      expect(
        screen.getByText(/I need a bit more information/i)
      ).toBeInTheDocument();
    });

    it('displays unresolved fields as badges', () => {
      render(<ClarificationPanel {...defaultProps} />);
      expect(screen.getByText('categories')).toBeInTheDocument();
      expect(screen.getByText('timeframe')).toBeInTheDocument();
    });

    it('displays available category names', () => {
      render(<ClarificationPanel {...defaultProps} />);
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Dining Out')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('shows "no categories available" when categories array is empty', () => {
      render(<ClarificationPanel {...defaultProps} categories={[]} />);
      expect(
        screen.getByText(/no dataset loaded/i)
      ).toBeInTheDocument();
    });

    it('shows "(second attempt)" on round 1', () => {
      render(<ClarificationPanel {...defaultProps} round={1} />);
      expect(screen.getByText('(second attempt)')).toBeInTheDocument();
    });

    it('renders a text input for clarification', () => {
      render(<ClarificationPanel {...defaultProps} />);
      const input = screen.getByLabelText(/your clarification/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders a submit button', () => {
      render(<ClarificationPanel {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: /submit clarification/i })
      ).toBeInTheDocument();
    });

    it('renders a cancel button', () => {
      render(<ClarificationPanel {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: /cancel clarification/i })
      ).toBeInTheDocument();
    });

    it('disables submit button when input is empty', () => {
      render(<ClarificationPanel {...defaultProps} />);
      const submitBtn = screen.getByRole('button', { name: /submit clarification/i });
      expect(submitBtn).toBeDisabled();
    });

    it('calls onRespond with trimmed text on submit', async () => {
      const user = userEvent.setup();
      const onRespond = jest.fn();
      render(<ClarificationPanel {...defaultProps} onRespond={onRespond} />);

      const input = screen.getByLabelText(/your clarification/i);
      await user.type(input, '  groceries last month  ');
      await user.click(screen.getByRole('button', { name: /submit clarification/i }));

      expect(onRespond).toHaveBeenCalledWith('groceries last month');
    });

    it('calls onRespond when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onRespond = jest.fn();
      render(<ClarificationPanel {...defaultProps} onRespond={onRespond} />);

      const input = screen.getByLabelText(/your clarification/i);
      await user.type(input, 'groceries{Enter}');

      expect(onRespond).toHaveBeenCalledWith('groceries');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      render(<ClarificationPanel {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByRole('button', { name: /cancel clarification/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onRespond with whitespace-only input', async () => {
      const user = userEvent.setup();
      const onRespond = jest.fn();
      render(<ClarificationPanel {...defaultProps} onRespond={onRespond} />);

      const input = screen.getByLabelText(/your clarification/i);
      await user.type(input, '   ');
      await user.click(screen.getByRole('button', { name: /submit clarification/i }));

      expect(onRespond).not.toHaveBeenCalled();
    });

    it('input is keyboard accessible (Tab navigable)', () => {
      render(<ClarificationPanel {...defaultProps} />);
      const input = screen.getByLabelText(/your clarification/i);
      expect(input.tabIndex).not.toBe(-1);
    });
  });

  describe('terminal state (round >= 2)', () => {
    it('shows terminal error message when round is 2', () => {
      render(<ClarificationPanel {...defaultProps} round={2} />);
      expect(
        screen.getByText(
          "Sorry, I couldn't understand your question. Please try submitting a new query."
        )
      ).toBeInTheDocument();
    });

    it('shows terminal error message when round exceeds 2', () => {
      render(<ClarificationPanel {...defaultProps} round={3} />);
      expect(
        screen.getByText(
          "Sorry, I couldn't understand your question. Please try submitting a new query."
        )
      ).toBeInTheDocument();
    });

    it('does not show a text input in terminal state', () => {
      render(<ClarificationPanel {...defaultProps} round={2} />);
      expect(screen.queryByLabelText(/your clarification/i)).not.toBeInTheDocument();
    });

    it('renders a "Start new query" button that calls onCancel', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      render(<ClarificationPanel {...defaultProps} round={2} onCancel={onCancel} />);

      const btn = screen.getByRole('button', { name: /start new query/i });
      expect(btn).toBeInTheDocument();
      await user.click(btn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('has role="alert" for screen reader announcement', () => {
      render(<ClarificationPanel {...defaultProps} round={2} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
