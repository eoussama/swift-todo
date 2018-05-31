const
    todoList = document.querySelector('.todo-list'),
    noticePanel = document.querySelector('.noticePanel'),
    todoCount = document.getElementById('todo-count');

var todos = [];

window.addEventListener("load", () => {
    const txtTodo = document.getElementById('txtTodo');

    loadTodos();
    txtTodo.focus();
    document.forms[0].addEventListener('submit', (e) => {
        e.preventDefault();

        if(txtTodo.value !== '') {
            addTodo(txtTodo.value);
            txtTodo.value = '';
            txtTodo.focus();
        }
    });
});

function createTodo(content) {
    let
        li = document.createElement('li'),
        p = document.createElement('p'),
        i = document.createElement('i');

    i.classList.add('fa', 'fa-trash-alt');
    p.textContent = content.trim();

    p.addEventListener('dblclick', () => {
        p.setAttribute('contenteditable', 'true');
    });

    p.addEventListener('blur', () => {
        p.setAttribute('contenteditable', 'false');
        todos[Array.prototype.indexOf.call(todoList.children, li) - 1] = p.textContent;
        p.classList.add('conf');
        setTimeout(() => { p.classList.remove('conf'); }, 1000);
        saveTodos();
    });

    i.addEventListener('click', () => {
        removeTodo(li);
    });

    li.appendChild(p);
    li.appendChild(i);
    todoList.appendChild(li);

    if(todoList.children.length !== 1)
        noticePanel.style.display = 'none';
    
    todoCount.textContent = (todoList.children.length - 1);
}

function addTodo(content) {
    createTodo(content);

    todos.push(content);
    saveTodos();
}

function removeTodo(todo) {
    todos.splice(Array.prototype.indexOf.call(todoList.children, todo) - 1, 1);
    todoList.removeChild(todo);
    
    if(todoList.children.length === 1)
        noticePanel.style.display = 'block';
    
    todoCount.textContent = (todoList.children.length - 1);
    saveTodos();
}

function saveTodos() { localStorage.setItem('todos', JSON.stringify(todos)); }

function loadTodos() {
    let _todos = localStorage.getItem('todos');

    if(_todos !== null)
        todos = JSON.parse(_todos);
    
    for(todo of todos)
        createTodo(todo);
}