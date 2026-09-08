// A hidden textarea keeps existing save handlers compatible with visual editing.
window.RichText = (() => {
    const prefix = 'richtext:v1:';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    const tags = new Set(['B', 'STRONG', 'I', 'EM', 'SPAN', 'FONT', 'BR', 'HR', 'DIV', 'P']);
    function sanitize(html) {
        const source = document.createElement('template');
        source.innerHTML = html;
        const clean = document.createElement('div');
        function copy(node, parent) {
            if (node.nodeType === 3) {
                parent.appendChild(document.createTextNode(node.textContent));
                return;
            }
            if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(node.tagName)) return;
            if (!tags.has(node.tagName)) {
                node.childNodes.forEach(child => copy(child, parent));
                return;
            }
            const next = document.createElement(node.tagName.toLowerCase());
            for (const property of ['color', 'font-size', 'font-weight', 'font-style']) {
                const value = node.style.getPropertyValue(property);
                if (value && !/url|var|expression/i.test(value)) next.style.setProperty(property, value);
            }
            if (node.tagName === 'FONT') {
                const color = node.getAttribute('color');
                if (color && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(color)) next.setAttribute('color', color);
                const size = node.getAttribute('size');
                if (/^[1-7]$/.test(size || '')) next.setAttribute('size', size);
            }
            node.childNodes.forEach(child => copy(child, next));
            if (['B', 'STRONG', 'I', 'EM', 'SPAN', 'FONT'].includes(node.tagName) && !next.textContent && !next.querySelector('hr')) {
                while (next.firstChild) parent.appendChild(next.firstChild);
                return;
            }
            parent.appendChild(next);
        }
        source.content.childNodes.forEach(node => copy(node, clean));
        return clean.innerHTML;
    }
    function render(value) {
        const text = String(value ?? '');
        if (text.startsWith(prefix)) return sanitize(text.slice(prefix.length));
        // Descriptions saved by the previous editor remain readable.
        return escape(text).replace(/\r\n?/g, '\n')
            .replace(/\[color=(#[0-9a-f]{6})\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
            .replace(/\[size=(12|16|20|24|32)\]([\s\S]*?)\[\/size\]/g, '<span style="font-size:$1px">$2</span>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
            .replace(/^---[ \t]*$/gm, '<hr>')
            .replace(/\n/g, '<br>');
    }
    function attach(input) {
        if (!input || input.dataset.richText) return;
        input.dataset.richText = 'true';
        const toolbar = document.createElement('div');
        toolbar.className = 'rich-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Formato de texto');
        toolbar.innerHTML = '<button type="button" class="btn" data-command="bold" aria-pressed="false"><b>Negrita</b></button><button type="button" class="btn" data-command="italic" aria-pressed="false"><i>Cursiva</i></button><button type="button" class="btn" data-command="insertHorizontalRule">Separador</button><label>Tamaño <select aria-label="Tamaño de letra"><option value="2">Pequeña</option><option value="3" selected>Normal</option><option value="4">Grande</option><option value="5">Muy grande</option><option value="6">Título</option></select></label><label>Color <input type="color" value="#ffffff" aria-label="Color del texto"></label><button type="button" class="btn" data-command="removeFormat">Quitar formato</button>';
        const editor = document.createElement('div');
        editor.className = 'rich-editor';
        editor.contentEditable = 'true';
        editor.setAttribute('role', 'textbox');
        editor.setAttribute('aria-multiline', 'true');
        editor.setAttribute('aria-label', input.id === 'notesBox' ? 'Notas' : 'Descripción');
        editor.dataset.placeholder = input.placeholder || 'Escribe aquí…';
        editor.id = input.id + '-visual';
        editor.innerHTML = render(input.value);
        const label = document.querySelector('label[for="' + input.id + '"]');
        if (label) label.htmlFor = editor.id;
        input.hidden = true;
        input.before(toolbar);
        input.after(editor);
        let savedRange = null;
        const remember = () => {
            const selection = window.getSelection();
            if (selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }
            for (const command of ['bold', 'italic']) {
                toolbar.querySelector('[data-command="' + command + '"]').setAttribute('aria-pressed', String(document.queryCommandState(command)));
            }
        };
        const sync = () => {
            const html = sanitize(editor.innerHTML);
            input.value = editor.textContent || editor.querySelector('hr') ? prefix + html : '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            remember();
        };
        function command(name, value = null) {
            editor.focus();
            const selection = window.getSelection();
            if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
                selection.removeAllRanges();
                selection.addRange(savedRange);
            }
            // Native editing preserves selection and undo history.
            document.execCommand(name, false, value);
            sync();
        }
        toolbar.querySelectorAll('button').forEach(button => {
            button.onmousedown = event => event.preventDefault();
            button.onclick = () => command(button.dataset.command);
        });
        toolbar.querySelector('select').onchange = event => command('fontSize', event.target.value);
        toolbar.querySelector('input').oninput = event => command('foreColor', event.target.value);
        editor.addEventListener('input', sync);
        editor.addEventListener('keyup', remember);
        editor.addEventListener('mouseup', remember);
        editor.addEventListener('blur', remember);
        editor.addEventListener('paste', event => {
            event.preventDefault();
            command('insertText', event.clipboardData.getData('text/plain'));
        });
        editor.addEventListener('drop', event => event.preventDefault());
        return editor;
    }
    return { render, attach };
})();
