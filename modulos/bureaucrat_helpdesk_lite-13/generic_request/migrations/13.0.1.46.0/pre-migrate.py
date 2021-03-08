def migrate(cr, installed_version):
    cr.execute("""
        UPDATE ir_model_data
        SET module = 'generic_request'
        WHERE module = 'generic_request_tag'
          AND model IN (
                 'ir.model.fields',
                 'ir.model.constraint',
                 'ir.model.relation',
                 'ir.ui.menu',
                 'ir.model.access',
                 'ir.actions.act_window',
                 'generic.tag',
                 'generic.tag.category',
                 'generic.tag.model');

        -- Update constraints
        UPDATE ir_model_constraint
        SET module = (
            SELECT id
            FROM ir_module_module
            WHERE name = 'generic_request'
        )
        WHERE module = (
            SELECT id
            FROM ir_module_module
            WHERE name = 'generic_request_tag'
        );

        -- Update relations
        UPDATE ir_model_relation
        SET module = (
            SELECT id
            FROM ir_module_module
            WHERE name = 'generic_request'
        )
        WHERE module = (
            SELECT id
            FROM ir_module_module
            WHERE name = 'generic_request_tag'
        );

        -- Delete views that inherits thats are defined in request_tag
        DELETE FROM ir_ui_view WHERE inherit_id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'generic_request_tag'
        );

        -- Delete views
        DELETE FROM ir_ui_view WHERE id IN (
            SELECT res_id
            FROM ir_model_data
            WHERE model = 'ir.ui.view'
              AND module = 'generic_request_tag'
        );

        -- DELETE references to ir_model
        DELETE FROM ir_model_data
        WHERE model = 'ir.model'
          AND module = 'generic_request_tag';

        -- DELETE removed modules from database
        DELETE FROM ir_module_module WHERE name = 'generic_request_tag';
    """)
