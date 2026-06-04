const API_BASE = 'http://localhost:8080/api/books';
let currentFilter = null;
let pendingDeleteId = null;

// ====== Page Load ======
document.addEventListener('DOMContentLoaded', loadBooks);

// ====== Load Books ======
async function loadBooks() {
    try {
        const res = await fetch(API_BASE);
        const books = await res.json();
        renderBooks(books);
        updateStats(books);
    } catch (err) {
        showToast('加载失败: ' + err.message, 'error');
    }
}

function renderBooks(books) {
    const grid = document.getElementById('bookGrid');
    if (books.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>这里空空如也</h3>
                <p>点击右上角「添加图书」开始藏书吧</p>
            </div>
        `;
        return;
    }
    grid.innerHTML = books.map(book => {
        const stockClass = book.stock <= 0 ? 'out' : (book.stock <= 5 ? 'low' : 'normal');
        const stockLabel = book.stock <= 0 ? '暂无库存' : (book.stock <= 5 ? `仅剩 ${book.stock} 本` : `库存 ${book.stock} 本`);
        return `
        <div class="book-card" data-id="${book.id}">
            <div class="book-card-inner">
                <div class="book-card-header">
                    <div class="book-title">${escapeHtml(book.title || '未命名')}</div>
                    <span class="book-stock-badge ${stockClass}">${stockLabel}</span>
                </div>
                <div class="book-author">${escapeHtml(book.author || '未知作者')}</div>
                <div class="book-meta">
                    ${book.isbn ? `<div class="meta-item">ISBN<strong>${escapeHtml(book.isbn)}</strong></div>` : ''}
                    ${book.publisher ? `<div class="meta-item">出版社<strong>${escapeHtml(book.publisher)}</strong></div>` : ''}
                    ${book.publishYear ? `<div class="meta-item">出版年份<strong>${escapeHtml(book.publishYear)}</strong></div>` : ''}
                    <div class="meta-item">库存数<strong>${book.stock}</strong></div>
                </div>
                ${book.description ? `<div class="book-desc">${escapeHtml(book.description)}</div>` : ''}
                <div class="book-actions">
                    <button class="btn btn-edit btn-sm" onclick="openModal(${book.id})">✏️ 编辑</button>
                    <button class="btn btn-delete btn-sm" onclick="openDeleteModal(${book.id}, '${escapeHtml(book.title)}')">🗑️ 删除</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ====== Stats ======
function updateStats(books) {
    document.getElementById('statTotal').textContent = books.length;
    const totalStock = books.reduce((sum, b) => sum + b.stock, 0);
    document.getElementById('statStock').textContent = totalStock;
    document.getElementById('totalBadge').textContent = books.length;
    const lowCount = books.filter(b => b.stock <= 5).length;
    document.getElementById('lowStockBadge').textContent = lowCount;
}

// ====== Search ======
let searchTimer;
function searchBooks() {
    const query = document.getElementById('searchInput').value.trim();
    document.getElementById('searchClear').style.display = query ? 'flex' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            const url = query ? `${API_BASE}/search?title=${encodeURIComponent(query)}` : API_BASE;
            const res = await fetch(url);
            const books = await res.json();
            renderBooks(books);
            updateStats(books);
            document.getElementById('pageTitle').textContent = query ? `🔍 搜索: "${query}"` : '📚 全部图书';
        } catch (err) {
            showToast('搜索失败', 'error');
        }
    }, 300);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    loadBooks();
    document.getElementById('pageTitle').textContent = '📚 全部图书';
    document.querySelector('.nav-item.active')?.classList.remove('active');
    document.querySelector('.nav-item:first-child')?.classList.add('active');
}

// ====== Filter ======
function filterLowStock() {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('pageTitle').textContent = '⚠️ 库存不足';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    fetch(API_BASE).then(r => r.json()).then(books => {
        const filtered = books.filter(b => b.stock <= 5);
        renderBooks(filtered);
        updateStats(books);
    });
}

// ====== Modal ======
function openModal(id) {
    document.getElementById('bookModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (id) {
        document.getElementById('modalTitle').textContent = '✏️ 编辑图书';
        document.getElementById('submitBtnText').textContent = '保存修改';
        fetchBook(id);
    } else {
        document.getElementById('modalTitle').textContent = '📝 添加图书';
        document.getElementById('submitBtnText').textContent = '确认添加';
        document.getElementById('bookForm').reset();
        document.getElementById('bookId').value = '';
    }
}

function closeModal() {
    document.getElementById('bookModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function fetchBook(id) {
    try {
        const res = await fetch(`${API_BASE}/${id}`);
        const book = await res.json();
        document.getElementById('bookId').value = book.id;
        document.getElementById('title').value = book.title || '';
        document.getElementById('author').value = book.author || '';
        document.getElementById('isbn').value = book.isbn || '';
        document.getElementById('publisher').value = book.publisher || '';
        document.getElementById('publishYear').value = book.publishYear || '';
        document.getElementById('stock').value = book.stock;
        document.getElementById('description').value = book.description || '';
    } catch (err) {
        showToast('获取详情失败', 'error');
        closeModal();
    }
}

// ====== Submit ======
document.getElementById('bookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('bookId').value;
    const bookData = {
        title: document.getElementById('title').value.trim(),
        author: document.getElementById('author').value.trim(),
        isbn: document.getElementById('isbn').value.trim(),
        publisher: document.getElementById('publisher').value.trim(),
        publishYear: document.getElementById('publishYear').value.trim(),
        stock: parseInt(document.getElementById('stock').value) || 0,
        description: document.getElementById('description').value.trim()
    };
    try {
        const url = id ? `${API_BASE}/${id}` : API_BASE;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookData) });
        if (!res.ok) throw new Error('请求失败');
        closeModal();
        loadBooks();
        showToast(id ? '✅ 图书信息已更新' : '✅ 新书已上架', 'success');
    } catch (err) {
        showToast('保存失败: ' + err.message, 'error');
    }
});

// ====== Delete ======
function openDeleteModal(id, title) {
    pendingDeleteId = id;
    document.getElementById('deleteBookTitle').textContent = title;
    document.getElementById('deleteModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById('deleteModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
        const res = await fetch(`${API_BASE}/${pendingDeleteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除失败');
        closeDeleteModal();
        loadBooks();
        showToast('🗑️ 图书已移除', 'success');
    } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
    }
}

// ====== Utilities ======
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'flex';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}