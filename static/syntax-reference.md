<table>
  <thead>
    <tr>
      <th>Syntax</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>word</code></td>
      <td>A single word will be parsed as a "word" token with no key. A <code>defaultKey</code> can be provided in the class options parameter.</td>
    </tr>
    <tr>
      <td><code>key:word</code></td>
      <td>A keyword includes a specific key to associate with the word or phrase. It will be parsed as a "keyword" token.</td>
    </tr>
    <tr>
      <td><code>"a phrase"</code></td>
      <td>This syntax will be parsed as a "phrase" token. It allows you to join multiple words together into one token.</td>
    </tr>
    <tr>
      <td><code>key:"a phrase"</code></td>
      <td>This syntax will be parsed as a "keyword_phrase" token. It combines the properties of the "keyword" and "phrase" tokens.</td>
    </tr>
    <tr>
      <td><code>/^regex$/</code></td>
      <td>This syntax will be parsed as a "regex" token. The regular expression between the <code>/</code> will be provided as a string and can be converted to a <code>RegExp</code> constructor in JS or passed to a SQL statement using supported syntax.</td>
    </tr>
    <tr>
      <td><code>key:/^regex$/</code></td>
      <td>This syntax combines the properties of the "keyword" syntax and the "regex" syntax.</td>
    </tr>
    <tr>
      <td><code>key=10</code><div><code>key&gt;=2024-01-01 00:00</code></div></td>
      <td>When using numeric operators for numbers or dates, the token will become a "keyword_numeric" or "keyword_date" token with the operator provided. See below (1) for supported date formats.</td>
    </tr>
    <tr>
      <td><code>key:10..20</code><div><code class="whitespace-nowrap">key:2024-01-01..2024-01-15</code></div></td>
      <td>Range queries allow you to specify a range of values. For ranges, use <code>key:start..end</code>. The result will be two "keyword_numeric" or "keyword_date" tokens. See below (1) for supported date formats.</td>
    </tr>
    <tr>
      <td><code>AND</code> <code>&amp;</code> <div><code>OR</code> <code>|</code></div></td>
      <td>Use <code>AND</code>/<code>&amp;</code> to require both conditions, <code>OR</code>/<code>|</code> for either condition. Adjacent terms default to <code>AND</code>.</td>
    </tr>
    <tr>
      <td><code>foo (bar or baz)</code></td>
      <td>Tokens can be grouped together using parentheses. Groups can also be nested.</td>
    </tr>
    <tr>
      <td><code>-</code><div><code>!</code></div></td>
      <td>The negator character can be used to negate any "word", "keyword", or "phrase" token. (Example: <code>-word -"phrase"</code> or <code>!word !"phrase"</code>) It can also be used to negate a group. (Example: <code>-(word1 OR word2)</code> or <code>!(word1 | word2)</code>)</td>
    </tr>
  </tbody>
</table>

1. The following [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) formats are supported:
   - ISO 8601 UTC - `YYYY-MM-DD[T| ]HH:mm(:ss(.sss))(Z)` - Seconds, milliseconds, and time zone are optional
   - ISO 8601 with offset - `YYYY-MM-DD[T| ]HH:mm(:ss(.sss))([+|-]HH:mm)` - Seconds, milliseconds, and time zone are optional
   - Full date - `YYYY-MM-DD`
   - Month - `YYYY-MM`
   - Year - `YYYY`
