(function () {

    document.addEventListener('DOMContentLoaded', restoreOptions);
    document.getElementById('save').addEventListener('click', saveOptions);

    function saveOptions() {

        var username = document.getElementById('username').value;
        var password = document.getElementById('password').value;
        var description = document.getElementById('description').value;
        var baseUrl = document.getElementById('baseUrl').value;
        var apiExtension = document.getElementById('apiExtension').value;
        var jql = document.getElementById('jql').value;
        var itemsOnPage = document.getElementById('itemsOnPage').value;

        chrome.storage.sync.set({
            username: username,
            password: password,
            description: description,
            baseUrl: baseUrl,
            apiExtension: apiExtension,
            jql: jql,
            itemsOnPage : itemsOnPage
        }, function() {
            var status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(function() {
              status.textContent = '';
            }, 1000);
        });
    }


    function restoreOptions() {

        chrome.storage.sync.get({
            username: '',
            password: '',
            description: '',
            baseUrl: '',
            apiExtension: '/rest/api/2',
            jql: 'assignee=currentUser()',
            itemsOnPage : 10
        }, function(items) {
            document.getElementById('username').value = items.username;
            document.getElementById('password').value = items.password;
            document.getElementById('description').value = items.description;
            document.getElementById('baseUrl').value = items.baseUrl;
            document.getElementById('apiExtension').value = items.apiExtension;
            document.getElementById('jql').value = items.jql;
            document.getElementById('itemsOnPage').value = items.itemsOnPage;
        });
    }
    
})(); 
