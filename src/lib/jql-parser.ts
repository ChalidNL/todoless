/**
 * JQL-inspired Query Language Parser for todoless
 * 
 * Supports:
 * - Field:value syntax (status:todo, priority:urgent, assignee:john)
 * - Label shorthand (#work, #urgent)
 * - Comparison operators (due:>2024-01-01, priority!=low)
 * - Boolean operators (AND, OR, NOT)
 * - Parentheses for grouping
 * - Free text search (matches title)
 * - Quoted values (title:"my task")
 * 
 * Examples:
 * - status:todo priority:urgent
 * - #work OR #personal
 * - NOT status:done
 * - (status:todo OR status:backlog) AND priority:urgent
 * - due:>2024-01-01 assignee:john
 * - "search terms" #label status:todo
 */

export type JQLTokenType =
  | 'FIELD'
  | 'VALUE'
  | 'OPERATOR'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'TEXT'
  | 'LABEL'
  | 'EOF';

export interface JQLToken {
  type: JQLTokenType;
  value: string;
  pos: number;
}

export type JQLFilterKind =
  | 'field'
  | 'text'
  | 'label'
  | 'and'
  | 'or'
  | 'not';

export interface JQLFieldFilter {
  kind: 'field';
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | '~';
  value: string;
}

export interface JQLTextFilter {
  kind: 'text';
  text: string;
}

export interface JQLLabelFilter {
  kind: 'label';
  name: string;
}

export interface JQLCompoundFilter {
  kind: 'and' | 'or' | 'not';
  children: JQLFilter[];
}

export type JQLFilter = JQLFieldFilter | JQLTextFilter | JQLLabelFilter | JQLCompoundFilter;

export interface JQLResult {
  ast: JQLFilter | null;
  errors: string[];
}

// Tokenizer
function tokenize(input: string): JQLToken[] {
  const tokens: JQLToken[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos])) {
      pos++;
      continue;
    }

    // Quoted string
    if (input[pos] === '"' || input[pos] === "'") {
      const quote = input[pos];
      pos++;
      let value = '';
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\') {
          pos++;
          value += input[pos] || '';
        } else {
          value += input[pos];
        }
        pos++;
      }
      pos++; // skip closing quote
      tokens.push({ type: 'TEXT', value, pos: pos - value.length - 2 });
      continue;
    }

    // Label shorthand #label
    if (input[pos] === '#') {
      pos++;
      let value = '';
      while (pos < input.length && /[\w-]/.test(input[pos])) {
        value += input[pos];
        pos++;
      }
      if (value) {
        tokens.push({ type: 'LABEL', value, pos: pos - value.length - 1 });
      }
      continue;
    }

    // Parentheses
    if (input[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos });
      pos++;
      continue;
    }

    if (input[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos });
      pos++;
      continue;
    }

    // Field: value or field:operator value
    if (/[a-zA-Z_]/.test(input[pos])) {
      let fieldOrWord = '';
      const start = pos;
      while (pos < input.length && /[\w]/.test(input[pos])) {
        fieldOrWord += input[pos];
        pos++;
      }

      // Check for colon (field:value)
      if (pos < input.length && input[pos] === ':') {
        pos++;
        // Check for operator after colon
        let operator: string = '=';
        if (pos < input.length && input[pos] === '!') {
          operator = '!=';
          pos++;
        } else if (pos < input.length && input[pos] === '>') {
          operator = '>';
          pos++;
          if (pos < input.length && input[pos] === '=') {
            operator = '>=';
            pos++;
          }
        } else if (pos < input.length && input[pos] === '<') {
          operator = '<';
          pos++;
          if (pos < input.length && input[pos] === '=') {
            operator = '<=';
            pos++;
          }
        } else if (pos < input.length && input[pos] === '~') {
          operator = '~';
          pos++;
        }

        // Read value
        let value = '';
        if (pos < input.length && (input[pos] === '"' || input[pos] === "'")) {
          const quote = input[pos];
          pos++;
          while (pos < input.length && input[pos] !== quote) {
            if (input[pos] === '\\') {
              pos++;
              value += input[pos] || '';
            } else {
              value += input[pos];
            }
            pos++;
          }
          pos++;
        } else {
          while (pos < input.length && /[\w-]/.test(input[pos])) {
            value += input[pos];
            pos++;
          }
        }

        tokens.push({ type: 'FIELD', value: fieldOrWord, pos: start });
        if (operator !== '=') {
          tokens.push({ type: 'OPERATOR', value: operator, pos: pos - operator.length });
        }
        tokens.push({ type: 'VALUE', value, pos: pos - value.length });
      } else {
        // Check for boolean operators
        const upper = fieldOrWord.toUpperCase();
        if (upper === 'AND') {
          tokens.push({ type: 'AND', value: 'AND', pos: start });
        } else if (upper === 'OR') {
          tokens.push({ type: 'OR', value: 'OR', pos: start });
        } else if (upper === 'NOT') {
          tokens.push({ type: 'NOT', value: 'NOT', pos: start });
        } else {
          // Free text
          tokens.push({ type: 'TEXT', value: fieldOrWord, pos: start });
        }
      }
      continue;
    }

    // Unknown character, skip
    pos++;
  }

  tokens.push({ type: 'EOF', value: '', pos });
  return tokens;
}

// Parser
class JQLParser {
  private tokens: JQLToken[];
  private pos: number;
  errors: string[] = [];

  constructor(tokens: JQLToken[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private current(): JQLToken {
    return this.tokens[this.pos] || { type: 'EOF', value: '', pos: -1 };
  }

  private consume(type?: JQLTokenType): JQLToken {
    const token = this.current();
    if (type && token.type !== type) {
      this.errors.push(`Expected ${type} at position ${token.pos}, got ${token.type} (${token.value})`);
      return token;
    }
    this.pos++;
    return token;
  }

  private peek(): JQLTokenType {
    return this.current().type;
  }

  private combine(kind: 'and' | 'or', left: JQLFilter, right: JQLFilter): JQLFilter {
    const children: JQLFilter[] = [];
    if (left.kind === kind) {
      children.push(...left.children);
    } else {
      children.push(left);
    }
    if (right.kind === kind) {
      children.push(...right.children);
    } else {
      children.push(right);
    }
    return { kind, children };
  }

  // Parse the full query
  parse(): JQLFilter | null {
    const result = this.parseExpression();
    if (this.peek() !== 'EOF') {
      this.errors.push(`Unexpected token at position ${this.current().pos}: ${this.current().value}`);
    }
    return result;
  }

  // expression = term (OR term)*
  private parseExpression(): JQLFilter | null {
    let left = this.parseTerm();

    while (this.peek() === 'OR') {
      this.consume('OR');
      const right = this.parseTerm();
      if (left && right) {
        left = this.combine('or', left, right);
      } else if (right) {
        left = right;
      }
    }

    return left;
  }

  // term = factor (factor)* [implicit AND]
  private parseTerm(): JQLFilter | null {
    let left = this.parseFactor();

    while (
      this.peek() !== 'EOF' &&
      this.peek() !== 'OR' &&
      this.peek() !== 'RPAREN'
    ) {
      // Check if next token is AND
      if (this.peek() === 'AND') {
        this.consume('AND');
      }
      // Implicit AND between factors
      const right = this.parseFactor();
      if (left && right) {
        left = this.combine('and', left, right);
      } else if (right) {
        left = right;
      }
    }

    return left;
  }

  // factor = NOT factor | LPAREN expression RPAREN | field:value | #label | text
  private parseFactor(): JQLFilter | null {
    // NOT
    if (this.peek() === 'NOT') {
      this.consume('NOT');
      const child = this.parseFactor();
      if (child) {
        return { kind: 'not', children: [child] };
      }
      return null;
    }

    // Parenthesized expression
    if (this.peek() === 'LPAREN') {
      this.consume('LPAREN');
      const expr = this.parseExpression();
      this.consume('RPAREN');
      return expr;
    }

    // Field: value
    if (this.peek() === 'FIELD') {
      const fieldToken = this.consume('FIELD');
      const field = fieldToken.value.toLowerCase();

      // Check for operator
      let operator: JQLFieldFilter['operator'] = '=';
      if (this.peek() === 'OPERATOR') {
        const opToken = this.consume('OPERATOR');
        operator = opToken.value as JQLFieldFilter['operator'];
      }

      // Check for value
      let value = '';
      if (this.peek() === 'VALUE') {
        value = this.consume('VALUE').value;
      }

      return { kind: 'field', field, operator, value };
    }

    // Label shorthand
    if (this.peek() === 'LABEL') {
      const labelToken = this.consume('LABEL');
      return { kind: 'label', name: labelToken.value };
    }

    // Free text
    if (this.peek() === 'TEXT') {
      const textToken = this.consume('TEXT');
      return { kind: 'text', text: textToken.value };
    }

    // Unexpected token
    if (this.peek() !== 'EOF') {
      this.errors.push(`Unexpected token at position ${this.current().pos}: ${this.current().value}`);
      this.consume();
    }

    return null;
  }
}

// Public API
export function parseJQL(input: string): JQLResult {
  if (!input || !input.trim()) {
    return { ast: null, errors: [] };
  }

  try {
    const tokens = tokenize(input.trim());
    const parser = new JQLParser(tokens);
    const ast = parser.parse();
    return { ast, errors: parser.errors };
  } catch (error) {
    return {
      ast: null,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

// Label name to ID resolver (to be called at evaluation time)
export type LabelResolver = (name: string) => string | null;

// Task-like interface for evaluation
export interface EvaluatableTask {
  id?: string;
  title: string;
  status?: string;
  priority?: string;
  horizon?: string;
  assignedTo?: string;
  blocked?: boolean;
  labels?: string[]; // label IDs
  dueDate?: number;
  createdAt?: number;
  isPrivate?: boolean;
  projectId?: string;
  sprintId?: string;
}

// Field filter evaluator
function evaluateFieldFilter(
  filter: JQLFieldFilter,
  task: EvaluatableTask,
  labelResolver?: LabelResolver,
): boolean {
  const { field, operator, value } = filter;
  let taskValue: string | number | boolean | undefined;

  switch (field) {
    case 'title':
      taskValue = task.title;
      break;
    case 'status':
      taskValue = task.status || '';
      break;
    case 'priority':
      taskValue = task.priority || 'normal';
      break;
    case 'horizon':
      taskValue = task.horizon || '';
      break;
    case 'assignee':
    case 'assigned':
    case 'assignedto':
      taskValue = task.assignedTo || '';
      break;
    case 'blocked':
      taskValue = task.blocked ? 'true' : 'false';
      break;
    case 'label':
    case 'labels':
    {
      // Special handling for label field - match against label IDs or names
      if (!task.labels || task.labels.length === 0) return false;
      // If value looks like a label ID (pb style), match directly
      // Otherwise resolve name to ID
      const resolvedId = labelResolver?.(value) || value;
      return task.labels.some(id => id === resolvedId || id === value);
    }
    case 'due':
    case 'duedate':
      taskValue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
      break;
    case 'created':
    case 'createdat':
      taskValue = task.createdAt ? new Date(task.createdAt).toISOString().slice(0, 10) : '';
      break;
    case 'private':
    case 'isprivate':
      taskValue = task.isPrivate ? 'true' : 'false';
      break;
    case 'project':
    case 'projectid':
      taskValue = task.projectId || '';
      break;
    case 'sprint':
    case 'sprintid':
      taskValue = task.sprintId || '';
      break;
    default:
      // Unknown field, try to match against title
      taskValue = task.title;
  }

  // Convert taskValue to string for comparison
  const taskStr = String(taskValue ?? '').toLowerCase();
  const valueStr = value.toLowerCase();

  switch (operator) {
    case '=':
      return taskStr === valueStr || taskStr.includes(valueStr);
    case '!=':
      return taskStr !== valueStr && !taskStr.includes(valueStr);
    case '>':
    {
      // Date or numeric comparison
      const taskDate = task.dueDate || task.createdAt || 0;
      const valueDate = new Date(value).getTime();
      return !isNaN(valueDate) ? taskDate > valueDate : false;
    }
    case '<':
    {
      const taskDateLt = task.dueDate || task.createdAt || 0;
      const valueDateLt = new Date(value).getTime();
      return !isNaN(valueDateLt) ? taskDateLt < valueDateLt : false;
    }
    case '>=':
    {
      const taskDateGte = task.dueDate || task.createdAt || 0;
      const valueDateGte = new Date(value).getTime();
      return !isNaN(valueDateGte) ? taskDateGte >= valueDateGte : false;
    }
    case '<=':
    {
      const taskDateLte = task.dueDate || task.createdAt || 0;
      const valueDateLte = new Date(value).getTime();
      return !isNaN(valueDateLte) ? taskDateLte <= valueDateLte : false;
    }
    case '~':
      // Contains (fuzzy match)
      return taskStr.includes(valueStr);
    default:
      return taskStr === valueStr;
  }
}

// Evaluate AST against a task
export function evaluateJQL(
  ast: JQLFilter | null,
  task: EvaluatableTask,
  labelResolver?: LabelResolver,
): boolean {
  if (!ast) return true; // No filter = match all

  switch (ast.kind) {
    case 'field':
      return evaluateFieldFilter(ast, task, labelResolver);

    case 'text':
      // Free text matches title
      return task.title.toLowerCase().includes(ast.text.toLowerCase());

    case 'label':
    {
      // Match label by name (resolve to ID)
      if (!labelResolver) return false;
      const labelId = labelResolver(ast.name);
      if (!labelId) return false;
      return task.labels?.includes(labelId) || false;
    }

    case 'and':
      return ast.children.every(child => evaluateJQL(child, task, labelResolver));

    case 'or':
      return ast.children.some(child => evaluateJQL(child, task, labelResolver));

    case 'not':
      return !ast.children.some(child => evaluateJQL(child, task, labelResolver));

    default:
      return true;
  }
}

// Convenience: filter tasks with JQL
export function filterTasks(
  query: string,
  tasks: EvaluatableTask[],
  labelResolver?: LabelResolver,
): EvaluatableTask[] {
  const { ast, errors } = parseJQL(query);
  if (errors.length > 0) {
    console.warn('JQL parse errors:', errors);
    // Fall back to simple text search if parsing fails
    if (query.trim()) {
      return tasks.filter(task =>
        task.title.toLowerCase().includes(query.toLowerCase()),
      );
    }
    return tasks;
  }

  return tasks.filter(task => evaluateJQL(ast, task, labelResolver));
}

// Get field suggestions for autocomplete
export const JQL_FIELDS = [
  'status',
  'priority',
  'horizon',
  'assignee',
  'blocked',
  'label',
  'due',
  'created',
  'private',
  'project',
  'sprint',
  'title',
];

export const JQL_FIELD_VALUES: Record<string, string[]> = {
  status: ['backlog', 'todo', 'done'],
  priority: ['urgent', 'normal', 'low'],
  horizon: ['week', 'month', '3months', '6months', 'year'],
  blocked: ['true', 'false'],
  private: ['true', 'false'],
};
