// A stack-based infix expression evaluator: tokenizer -> shunting-yard
// (infix -> postfix) -> postfix evaluation, using hand-rolled stack ADTs
// (no libc containers). Compiled to WebAssembly via Emscripten and driven
// directly from JavaScript through EMSCRIPTEN_KEEPALIVE exports - no
// server involved. Same kind of custom-ADT-over-raw-arrays approach as
// ITB's Algorithms & Data Structures coursework (stacks/queues built from
// scratch rather than a standard library container).
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_TOKENS 256
#define MAX_TOKEN_LEN 32
#define STACK_CAP 256

typedef struct {
  char items[STACK_CAP][MAX_TOKEN_LEN];
  int top;
} StrStack;

static void ss_init(StrStack *s) { s->top = -1; }
static int ss_empty(StrStack *s) { return s->top < 0; }
static void ss_push(StrStack *s, const char *tok) {
  if (s->top + 1 >= STACK_CAP) return;
  strncpy(s->items[++s->top], tok, MAX_TOKEN_LEN - 1);
  s->items[s->top][MAX_TOKEN_LEN - 1] = '\0';
}
static const char *ss_peek(StrStack *s) { return s->top < 0 ? "" : s->items[s->top]; }
static void ss_pop(StrStack *s) { if (s->top >= 0) s->top--; }

typedef struct {
  double items[STACK_CAP];
  int top;
} NumStack;

static void ns_init(NumStack *s) { s->top = -1; }
static void ns_push(NumStack *s, double v) { if (s->top + 1 < STACK_CAP) s->items[++s->top] = v; }
static double ns_pop(NumStack *s) { return s->top >= 0 ? s->items[s->top--] : 0.0; }
static int ns_size(NumStack *s) { return s->top + 1; }

static int precedence(char op) {
  if (op == '+' || op == '-') return 1;
  if (op == '*' || op == '/') return 2;
  return 0;
}

static int is_op(const char *tok) {
  return tok[1] == '\0' && strchr("+-*/", tok[0]) != NULL;
}

// Output buffers, static so we can return pointers to JS without malloc bookkeeping.
static char g_tokens_out[MAX_TOKENS * (MAX_TOKEN_LEN + 1)];
static char g_postfix_out[MAX_TOKENS * (MAX_TOKEN_LEN + 1)];
static char g_error[128];

// Tokenize into a space-separated string (numbers, + - * / ( )).
static int tokenize(const char *expr, char tokens[MAX_TOKENS][MAX_TOKEN_LEN]) {
  int n = 0;
  int i = 0;
  int len = (int)strlen(expr);
  while (i < len) {
    char c = expr[i];
    if (isspace((unsigned char)c)) { i++; continue; }
    if (isdigit((unsigned char)c) || c == '.') {
      int j = 0;
      while (i < len && (isdigit((unsigned char)expr[i]) || expr[i] == '.')) {
        if (j < MAX_TOKEN_LEN - 1) tokens[n][j++] = expr[i];
        i++;
      }
      tokens[n][j] = '\0';
      n++;
      continue;
    }
    if (strchr("+-*/()", c) != NULL) {
      tokens[n][0] = c;
      tokens[n][1] = '\0';
      n++;
      i++;
      continue;
    }
    // Unknown character: skip it.
    i++;
  }
  return n;
}

static double g_result = 0.0;
static int g_ok = 1;

EMSCRIPTEN_KEEPALIVE
int c_run(const char *expr) {
  static char tokens[MAX_TOKENS][MAX_TOKEN_LEN];
  int n = tokenize(expr, tokens);

  g_tokens_out[0] = '\0';
  for (int i = 0; i < n; i++) {
    strcat(g_tokens_out, tokens[i]);
    if (i != n - 1) strcat(g_tokens_out, " ");
  }

  // Shunting-yard: infix -> postfix.
  StrStack opStack;
  ss_init(&opStack);
  char postfix[MAX_TOKENS][MAX_TOKEN_LEN];
  int pfCount = 0;

  for (int i = 0; i < n; i++) {
    char *tok = tokens[i];
    if (isdigit((unsigned char)tok[0]) || (tok[0] == '.' && isdigit((unsigned char)tok[1]))) {
      strcpy(postfix[pfCount++], tok);
    } else if (tok[0] == '(') {
      ss_push(&opStack, tok);
    } else if (tok[0] == ')') {
      while (!ss_empty(&opStack) && ss_peek(&opStack)[0] != '(') {
        strcpy(postfix[pfCount++], ss_peek(&opStack));
        ss_pop(&opStack);
      }
      if (!ss_empty(&opStack)) ss_pop(&opStack); // discard '('
    } else if (is_op(tok)) {
      while (!ss_empty(&opStack) && is_op(ss_peek(&opStack)) &&
             precedence(ss_peek(&opStack)[0]) >= precedence(tok[0])) {
        strcpy(postfix[pfCount++], ss_peek(&opStack));
        ss_pop(&opStack);
      }
      ss_push(&opStack, tok);
    }
  }
  while (!ss_empty(&opStack)) {
    strcpy(postfix[pfCount++], ss_peek(&opStack));
    ss_pop(&opStack);
  }

  g_postfix_out[0] = '\0';
  for (int i = 0; i < pfCount; i++) {
    strcat(g_postfix_out, postfix[i]);
    if (i != pfCount - 1) strcat(g_postfix_out, " ");
  }

  // Evaluate postfix.
  NumStack nums;
  ns_init(&nums);
  g_ok = 1;
  g_error[0] = '\0';

  for (int i = 0; i < pfCount; i++) {
    char *tok = postfix[i];
    if (is_op(tok)) {
      if (ns_size(&nums) < 2) {
        g_ok = 0;
        strcpy(g_error, "malformed expression: not enough operands");
        break;
      }
      double b = ns_pop(&nums);
      double a = ns_pop(&nums);
      double r = 0;
      switch (tok[0]) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/':
          if (b == 0.0) { g_ok = 0; strcpy(g_error, "division by zero"); }
          else r = a / b;
          break;
      }
      ns_push(&nums, r);
    } else {
      ns_push(&nums, atof(tok));
    }
  }

  if (g_ok && ns_size(&nums) != 1) {
    g_ok = 0;
    strcpy(g_error, "malformed expression: leftover operands");
  }

  g_result = g_ok ? ns_pop(&nums) : 0.0;
  return g_ok;
}

EMSCRIPTEN_KEEPALIVE
double c_get_result(void) { return g_result; }

EMSCRIPTEN_KEEPALIVE
const char *c_get_error(void) { return g_error; }

EMSCRIPTEN_KEEPALIVE
const char *c_get_tokens(void) { return g_tokens_out; }

EMSCRIPTEN_KEEPALIVE
const char *c_get_postfix(void) { return g_postfix_out; }
