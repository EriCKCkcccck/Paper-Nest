[README.md](https://github.com/user-attachments/files/30177295/README.md)
# PaperNest 文献共享网站

PaperNest 是一个响应式个人文献库，包含六个板块：

- Chinese
- English
- Maths
- Chemistry
- Psychology
- Economics

## 已实现功能

- 添加论文标题、作者、年份、链接、标签和个人笔记
- 上传 PDF
- 按六个学科分类
- 全文搜索
- 按添加时间、标题和年份排序
- 编辑与删除
- JSON 导出 / 导入备份
- 本地浏览器存储
- 可连接 Supabase，实现跨设备云端同步
- 手机、平板、电脑自适应

## 直接使用本地版

双击 `index.html` 即可打开。  
本地模式的数据只保存在当前浏览器中。建议定期点击“导出备份”。

> 某些浏览器对直接打开本地 HTML 的功能有限。更稳定的方法是在文件夹内启动本地服务器：
>
> `python3 -m http.server 8080`
>
> 然后访问 `http://localhost:8080`

## 免费部署到 GitHub Pages

1. 新建 GitHub repository。
2. 上传 `index.html`、`styles.css`、`app.js`。
3. 打开 Settings → Pages。
4. Source 选择 `Deploy from a branch`。
5. 选择 `main` 分支和 `/root` 文件夹。
6. 保存后即可获得公开网址。

## 配置 Supabase 云端同步

### 1. 创建项目

在 Supabase 新建一个项目。

### 2. 创建数据表

进入 SQL Editor，运行：

```sql
create table public.papers (
  id text primary key,
  title text not null,
  subject text not null,
  year integer,
  authors text,
  url text,
  tags jsonb default '[]'::jsonb,
  notes text,
  file_url text,
  file_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.papers enable row level security;

create policy "Public read papers"
on public.papers for select
using (true);

create policy "Public insert papers"
on public.papers for insert
with check (true);

create policy "Public update papers"
on public.papers for update
using (true);

create policy "Public delete papers"
on public.papers for delete
using (true);
```

### 3. 创建 PDF 存储桶

进入 Storage：

1. 创建 bucket，名称必须为 `papers`
2. 设置为 Public bucket
3. 添加允许上传和读取的 policy

简易测试版可以使用公开策略。正式共享网站建议加入 Supabase Auth，只允许登录用户写入。

### 4. 在网站内连接

1. 打开网站。
2. 点击右上角齿轮。
3. 填入 Supabase `Project URL`。
4. 填入 Supabase `anon public key`。
5. 点击“保存并连接”。

这些配置只保存在当前浏览器，不会写进网站源代码。

## 安全提醒

当前云端方案为了快速使用，SQL 示例允许公开增删改查。如果网址只由你自己使用，风险较低；若准备公开分享，建议下一步加入：

- Supabase Auth 登录
- 基于 `user_id` 的 Row Level Security
- 管理员和访客权限
- 私有 PDF bucket
- 邮箱邀请制

## 文件结构

- `index.html`：网页结构
- `styles.css`：视觉设计和响应式布局
- `app.js`：论文管理、本地存储、云端同步
- `README.md`：部署和配置说明
