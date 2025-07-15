/* eslint-disable no-unused-vars */
// validate.js
import { Buffer } from 'buffer';
import Ajv2019 from "ajv/dist/2019"
import addFormats from "ajv-formats";
const ajv = new Ajv2019({allErrors: true});
// amazon 自定义keywords
// 信息性关键字: 实际上不影响验证，这些关键字更多地用于描述信息。
const informationalKeywords = [
    'editable',
    'hidden',
    'enumNames',
    '$lifecycle',
    'replacedBy',
    'replaces',
    'selectors',
    'enumDeprecated',
    'enumReplacement'
];

informationalKeywords.forEach(keyword => {
    ajv.addKeyword(keyword, {
        type: ['boolean', 'array', 'object'],
        metaSchema: {} // 允许任意结构
    });
});

// 验证性关键字
ajv.addKeyword('maxUniqueItems', {
    type: 'array',
    compile: function (maxUniqueItems, parentSchema) {
        return function (data) {
            const uniqueItems = new Set(data.map(item => JSON.stringify(item)));
            return uniqueItems.size <= maxUniqueItems;
        };
    },
    metaSchema: {
        type: 'integer',
        minimum: 0
    }
});

ajv.addKeyword('minUniqueItems', {
    type: 'array',
    compile: function (minUniqueItems, parentSchema) {
        return function (data) {
            const uniqueItems = new Set(data.map(item => JSON.stringify(item)));
            return uniqueItems.size >= minUniqueItems;
        };
    },
    metaSchema: {
        type: 'integer',
        minimum: 0
    }
});

ajv.addKeyword('maxUtf8ByteLength', {
    type: 'string',
    compile: function (maxLength) {
        return function (data) {
            return Buffer.byteLength(data, 'utf8') <= maxLength;
        };
    },
    metaSchema: {
        type: 'integer',
        minimum: 0
    }
});

ajv.addKeyword('minUtf8ByteLength', {
    type: 'string',
    compile: function (minLength) {
        return function (data) {
            return Buffer.byteLength(data, 'utf8') >= minLength;
        };
    },
    metaSchema: {
        type: 'integer',
        minimum: 0
    }
});


addFormats(ajv)

export function validateData(data, schema) {
    // console.log('validateData data:', JSON.stringify(data))
    // console.log('validateData schema:', JSON.stringify(schema))
    const validate = ajv.compile(schema)
    // 进行验证
    const valid = validate(data);
    // 如果验证失败，输出错误信息
    if (!valid) {
        console.log('schema:', validate.schema)
        validate.errors.forEach(error => {
            // #/allOf/28/then/required
            let pathArray = error.schemaPath.split('/')
            let rule = validate.schema[pathArray[1]]
            console.log('error:', error)
        })
        return validate.errors;
    }
}

export function parseSchema(schema) {
    const dependencies = {};

    if (schema.allOf) {
        schema.allOf.forEach(subSchema => {
            Object.assign(dependencies, parseSchema(subSchema));
        });
    }

    if (schema.if) {
        const thenProperties = schema.then ? schema.then.properties || {} : {};
        const elseProperties = schema.else ? schema.else.properties || {} : {};

        const ifProperties = Object.keys(schema.if.properties || {}).reduce((acc, key) => {
            acc[key] = { if: schema.if.properties[key] };
            return acc;
        }, {});

        Object.entries(thenProperties).forEach(([key, value]) => {
            ifProperties[key] = { ...(ifProperties[key] || {}), then: value };
        });

        Object.entries(elseProperties).forEach(([key, value]) => {
            ifProperties[key] = { ...(ifProperties[key] || {}), else: value };
        });

        Object.assign(dependencies, ifProperties);
    }

    return dependencies;
}

function resolveRef(schema, refPath) {
    const path = refPath.slice(2).split('/'); // "#/$defs/some_ref" 转换成 ["$defs", "some_ref"]
    let current = schema;
    for (const segment of path) {
      if (current[segment] !== undefined) {
        current = current[segment];
      } else {
        throw new Error(`Reference ${refPath} cannot be resolved`);
      }
    }
    return current;
  }

export function parseSchemaProperties(schema, rootSchema = schema) {
    for (const [key, property] of Object.entries(schema.properties || {})) {
        if (property.$ref) {
          const resolved = resolveRef(rootSchema, property.$ref);
          schema.properties[key] = { ...resolved }; // 将 $ref 替换为解析后的对象
        } else if (property.type === 'object' && property.properties) {
            parseSchemaProperties(property, rootSchema); // 递归解析对象类型
        } else if (property.type === 'array' && property.items && property.items.type === 'object') {
            parseSchemaProperties(property.items, rootSchema); // 递归解析数组中的对象
        }
      }
      return schema;
 
  }
  
// 获取必填属性 
export function getRequiredProperties(schema) {
    let requiredProperties = [];
    const validate = ajv.compile(schema)
    validate({})
    validate.errors.forEach(error => {
        if(error.keyword == 'required') {
            requiredProperties.push(error.params.missingProperty)
        }
    })
    return requiredProperties;
}