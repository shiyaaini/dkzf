$(document).ready(function() {
  // 启用/禁用转发规则
  $('.toggle-forward').on('change', function() {
    const id = $(this).data('id');
    const statusText = $(this).siblings('label').find('.status-text');
    
    $.ajax({
      url: `/toggle-forward/${id}`,
      method: 'POST',
      success: function(response) {
        if (response.success) {
          statusText.text(response.enabled ? '启用' : '禁用');
        } else {
          alert('操作失败: ' + response.message);
          // 还原开关状态
          $(this).prop('checked', !$(this).prop('checked'));
        }
      },
      error: function() {
        alert('服务器错误，请稍后再试');
        // 还原开关状态
        $(this).prop('checked', !$(this).prop('checked'));
      }
    });
  });
  
  // 删除转发规则
  let deleteId = null;
  
  $('.delete-forward').on('click', function() {
    deleteId = $(this).data('id');
    $('#deleteModal').modal('show');
  });
  
  $('#confirmDelete').on('click', function() {
    if (deleteId) {
      $.ajax({
        url: `/delete-forward/${deleteId}`,
        method: 'POST',
        success: function(response) {
          if (response.success) {
            $('#deleteModal').modal('hide');
            // 重新加载页面以显示更新后的列表
            window.location.reload();
          } else {
            alert('删除失败: ' + response.message);
          }
        },
        error: function() {
          alert('服务器错误，请稍后再试');
        }
      });
    }
  });
  
  // 表单验证
  $('form').on('submit', function(e) {
    const sourcePort = parseInt($('#sourcePort').val());
    const targetPort = parseInt($('#targetPort').val());
    
    if (sourcePort < 1 || sourcePort > 65535) {
      alert('源端口必须在1-65535范围内');
      e.preventDefault();
      return false;
    }
    
    if (targetPort < 1 || targetPort > 65535) {
      alert('目标端口必须在1-65535范围内');
      e.preventDefault();
      return false;
    }
    
    return true;
  });
}); 