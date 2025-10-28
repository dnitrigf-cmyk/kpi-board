
/* ==== Firebase integration shim (boards-per-user) ==== */
import('./firestore.js').then(mod => {
  const { listenDepartments, listenBoardsByDepartment, saveBoard, upsertDepartment } = mod;

  // Replace local load with cloud snapshots
  const rebuildFromBoards = (boards) => {
    orgData = { departments: {} };
    // ensure currentDepartment exists
    if (!currentDepartment) currentDepartment = 'General';
    for (const b of boards){
      const dep = b.departmentId || 'General';
      orgData.departments[dep] = orgData.departments[dep] || { users: {} };
      orgData.departments[dep].users[b.userName] = { title: b.userTitle || '', board: b.board };
    }
    if (!orgData.departments[currentDepartment]) currentDepartment = Object.keys(orgData.departments)[0] || 'General';
    const users = Object.keys(orgData.departments[currentDepartment]?.users||{});
    if (!users.length){
      orgData.departments[currentDepartment] = orgData.departments[currentDepartment] || { users: {} };
      orgData.departments[currentDepartment].users["User 1"] = { title:"", board: defaultBoard() };
    }
    currentUser = Object.keys(orgData.departments[currentDepartment].users)[0];
    renderUsers(); renderTable();
  };

  window._onSignIn = async (u) => {
    // Departments
    listenDepartments((depts)=>{
      // create local placeholders; chips are built from orgData via boards stream
      if (!depts.find(d=>d.id==='General')) upsertDepartment('General');
    });
    // Boards stream for active department
    const sub = () => listenBoardsByDepartment(currentDepartment, rebuildFromBoards);
    let unsub = sub();
    // Re-subscribe on dept change by intercepting switchDepartment
    const _switch = switchDepartment;
    switchDepartment = function(d){
      _switch(d);
      if (unsub) unsub();
      unsub = sub();
    };

    // Hijack save() to push current user's board to Firestore
    const _save = save;
    save = function(){
      try {
        const dept = currentDepartment;
        const uname = currentUser;
        const node = orgData.departments[dept].users[uname];
        // Find existing board id from last snapshot if present
        // We'll attach ids map on latest rebuild
        const id = window.__boardIds?.[dept]?.[uname] || null;
        saveBoard({
          id,
          departmentId: dept,
          userName: uname,
          userTitle: node.title || '',
          board: node.board,
          ownerUid: (window.firebaseAuthUid || null)
        });
      } catch(e){ console.warn('Cloud save failed:', e); }
      _save(); // keep local cache as fallback
    };

    // Store uid globally for ownerUid
    window.firebaseAuthUid = u.uid;
  };

  // Keep map of board ids for updates
  // Extend rebuild to capture ids
  const _rebuild = rebuildFromBoards;
  const rebuildWithIds = (docs) => {
    window.__boardIds = window.__boardIds || {};
    const map = {};
    for (const b of docs){
      map[b.departmentId] = map[b.departmentId] || {};
      map[b.departmentId][b.userName] = b.id;
    }
    window.__boardIds = map;
    _rebuild(docs);
  };
  // Override the listener binding to use the id-aware rebuild
  listenBoardsByDepartment.toString(); // noop
}).catch(console.error);
