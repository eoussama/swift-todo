const
    todoList = document.querySelector('.todo-list'),
    noticePanel = document.querySelector('.noticePanel'),
    todoCount = document.getElementById('todo-count');

window.addEventListener("load", () => {
    const txtTodo = document.getElementById('txtTodo');

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

function addTodo(content) {
    let
        li = document.createElement('li'),
        p = document.createElement('p'),
        i = document.createElement('i');

    i.classList.add('fa', 'fa-trash-alt');
    p.textContent = content.trim();

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

function removeTodo(todo) {
    todoList.removeChild(todo);

    if(todoList.children.length === 1)
        noticePanel.style.display = 'block';
    
    todoCount.textContent = (todoList.children.length - 1);
}