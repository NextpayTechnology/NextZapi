import { readFileSync, writeFileSync } from 'fs';
import { exit } from 'process';

const filePath = './index.js';

try {
  let content = readFileSync(filePath, 'utf8');

  content = content.replace(
    /import \* as (\$protobuf) from/g,
    'import $1 from'
  );

  content = content.replace(
    /(['"])protobufjs\/minimal(['"])/g,
    '$1protobufjs/minimal.js$2'
  );

  content = content.replace(
    /^import \$protobuf from "protobufjs\/minimal\.js";/m,
    'const $protobuf = require("protobufjs/minimal.js");'
  );

  content = content.replace(
    /^export const proto = \$root\.proto = \(\(\) => \{/m,
    'const proto = $root.proto = (() => {'
  );

  content = content.replace(
    /^export \{ \$root as default \};\s*$/m,
    'module.exports = { proto, default: $root };\nmodule.exports.proto = proto;\nmodule.exports.default = $root;'
  );

  writeFileSync(filePath, content, 'utf8');

  console.log(`✅ Fixed imports in ${filePath}`);
} catch (error) {
  console.error(`❌ Error fixing imports: ${error.message}`);
  exit(1);
}
