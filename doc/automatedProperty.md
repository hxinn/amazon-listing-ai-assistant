AutomatedPropertyVerification 任务处理流程开发方案

## 初始化阶段
1. 进入页面通过`getAdapterProperties.md`接口加载待处理的属性，展示至进度条总数
   - 添加加载状态指示器
   - 添加错误处理和重试机制
   - 缓存已加载的属性，避免重复请求

## 任务处理阶段
2. 点击开始任务
   - 通过`amazonApi.searchProductTypeTemplateJsonAttr` 获取参考配置属性，记录返回结果作为当前属性的配置参考属性
     - 添加错误处理和重试机制
     - 优化请求参数，确保正确的URL和数据格式
   - 遍历每个属性通过`findPropertiesProductType.md`接口获取当前属性需要适配的站点与分类类型
     - 添加并发处理机制，提高处理效率
     - 实现暂停/恢复功能，支持中断后继续处理

3. 创建子任务，按照每个分类类型与站点进行AI数据匹配验证
   - 根据站点分类类型获取JSONSchema `amazonApi.getSchemaUrl`
   - 加载JsonSchema `amazonApi.fetchSchema`
     - 添加缓存机制，避免重复请求相同的Schema
   - 根据JsonSchema，获取当前属性properties
     - 添加属性验证，确保属性存在于Schema中
   - 调用aiService.generateJson，获取AI匹配后的数据
     - 添加超时和重试机制
     - 实现批量处理，提高效率
   - 生成数据记录，用于后续导出
     - 添加数据验证步骤，确保生成的数据符合Schema要求
     - 实现增量保存，防止数据丢失

## 结果处理阶段
4. 记录日志输出到控制台中
   - 实现分级日志（info, warning, error, success）
   - 添加详细的任务进度信息
   - 支持日志导出功能

5. 导出处理结果
   - 支持多种导出格式（JSON, Excel）
   - 添加导出进度指示器
   - 实现选择性导出（按站点、按分类类型筛选）


